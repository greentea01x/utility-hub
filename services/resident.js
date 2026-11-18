import { withTx } from '../db/tx.js';
import { AppError } from '../lib/errors.js';
import { monthLabel } from '../lib/presentation.js';

const number = value => value == null ? null : Number(value);
const date = value => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year','month','day'].map(key => parts.find(part => part.type === key).value).join('-');
};

export async function loadResidentData(lineUserId) {
  return withTx(async connection => {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const [[tenant]] = await connection.execute(`SELECT t.id, t.full_name, t.move_in_date, t.line_linked_at,
      r.id AS room_id, r.room_number, r.floor, r.area_sqm
      FROM tenants t JOIN rooms r ON r.id = t.room_id
      WHERE t.line_user_id = ? AND t.status = 'Active' AND t.move_out_date IS NULL AND r.status = 'Occupied'`, [lineUserId]);
    if (!tenant) throw new AppError(403, 'NOT_LINKED', 'บัญชี LINE นี้ยังไม่ได้ผูกกับห้องพักที่ใช้งานอยู่ กรุณาติดต่อสำนักงานนิติบุคคล');
    const [[settings]] = await connection.execute('SELECT apartment_name, address, phone, office_hours FROM settings WHERE id = 1');
    const [rates] = await connection.execute(`SELECT DISTINCT ON (utility_type) utility_type, unit_price FROM rates
      WHERE effective_from <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date ORDER BY utility_type, effective_from DESC`);
    // Explicit ownership prevents a new occupant seeing a previous occupant's
    // documents. Legacy bills without an owner stay office-only until reviewed.
    const [rows] = await connection.execute(`SELECT b.id, b.period, b.status, b.due_date, b.total, b.approved_at,
      p.received_at, p.amount AS paid_amount, p.method, rc.receipt_number,
      COALESCE((SELECT json_agg(json_build_object('type', i.utility_type, 'quantity', i.quantity, 'rate', i.unit_price, 'amount', i.amount)) FROM bill_items i WHERE i.bill_id = b.id), '[]') AS items,
      COALESCE((SELECT json_agg(json_build_object('type', m.utility_type, 'previous', m.previous_reading, 'current', m.current_reading)) FROM meter_readings m WHERE m.room_id = b.room_id AND m.period = b.period), '[]') AS readings
      FROM bills b LEFT JOIN payments p ON p.bill_id = b.id AND p.voided_at IS NULL AND b.status = 'Paid'
      LEFT JOIN receipts rc ON rc.payment_id = p.id
      WHERE b.tenant_id = ? AND b.room_id = ? AND b.status IN ('Unpaid','Paid') AND b.approved_at IS NOT NULL
      ORDER BY b.period DESC, b.id DESC`, [tenant.id, tenant.room_id]);
    const [announcements] = await connection.execute(`SELECT id, title, body, created_at FROM announcements
      WHERE audience = 'all' ORDER BY created_at DESC, id DESC LIMIT 100`);
    const bills = rows.map(row => {
      const item = type => row.items.find(entry => entry.type === type);
      const utility = type => {
        const line = item(type), reading = row.readings.find(entry => entry.type === type);
        return { units: number(line?.quantity), rate: number(line?.rate), amount: number(line?.amount), previous: number(reading?.previous), current: number(reading?.current) };
      };
      const common = item('common');
      return { id: String(row.id), period: row.period, label: monthLabel(row.period), status: row.status === 'Paid' ? 'paid' : 'pending',
        issueDate: date(row.approved_at), dueDate: date(row.due_date), paidDate: date(row.received_at), total: Number(row.total),
        receiptId: row.receipt_number ?? null, water: utility('water'), electricity: utility('electric'),
        common: { area: number(common?.quantity), rate: number(common?.rate), amount: number(common?.amount) } };
    });
    const rate = type => number(rates.find(entry => entry.utility_type === type)?.unit_price);
    const brand = settings?.apartment_name || 'Condo one';
    return {
      brand, isDemo: false,
      resident: { name: tenant.full_name, room: tenant.room_number, floor: tenant.floor, area: Number(tenant.area_sqm), building: null,
        occupancy: 'พักอาศัยอยู่', linkedAt: date(tenant.line_linked_at), lineLinked: true },
      rates: { water: rate('water'), electricity: rate('electric'), common: rate('common'), commonPeriod: 'month' },
      commonIncludedServices: ['ฟิตเนส', 'สระว่ายน้ำ', 'ค่าทิ้งขยะ', 'ค่าแม่บ้าน', 'ค่ารักษาความปลอดภัย'],
      bills,
      receipts: rows.filter(row => row.receipt_number).map(row => ({ id: row.receipt_number, billId: String(row.id), date: date(row.received_at), amount: Number(row.paid_amount), method: row.method === 'cash' ? 'เงินสด' : row.method })),
      announcements: announcements.map(row => ({ id: String(row.id), title: row.title, date: date(row.created_at), category: 'general', categoryLabel: 'ประกาศทั่วไป', summary: row.body, paragraphs: row.body.split(/\r?\n/).filter(Boolean) })),
      office: { name: `สำนักงานนิติบุคคล ${brand}`, contactName: 'เจ้าหน้าที่นิติบุคคล', contactNameStatus: 'สอบถามบิล ใบเสร็จ และข้อมูลห้องพัก',
        phone: process.env.RESIDENT_OFFICE_PHONE?.trim() || '081-234-5678', phoneConfirmed: true,
        location: settings?.address || 'สอบถามสำนักงาน', days: '', hours: settings?.office_hours || 'สอบถามสำนักงาน', paymentMethod: 'เงินสดที่สำนักงานนิติบุคคล' },
      historyNotice: 'แสดงเฉพาะบิลที่อนุมัติและระบุผู้รับบิลตรงกับบัญชีของคุณ หากไม่พบบิลย้อนหลัง กรุณาติดต่อสำนักงานเพื่อตรวจสอบ',
    };
  });
}

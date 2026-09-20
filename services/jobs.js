import pool from '../db/pool.js';

export async function runDailyJob() {
  const [bills] = await pool.execute(`SELECT b.due_date, t.id AS tenant_id
    FROM bills b JOIN rooms r ON r.id=b.room_id JOIN tenants t ON t.room_id=r.id AND t.status='Active'
    WHERE b.status='Unpaid' AND (b.due_date = CURDATE() + INTERVAL 3 DAY OR b.due_date < CURDATE())`);
  let queued = 0;
  for (const bill of bills) {
    const type = bill.due_date < new Date().toISOString().slice(0, 10) ? 'OVERDUE' : 'PRE_DUE';
    const [result] = await pool.execute(
      `INSERT INTO notifications (tenant_id, type, body)
      SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE tenant_id=? AND type=? AND DATE(created_at)=CURDATE())`,
      [
        bill.tenant_id,
        type,
        type === 'OVERDUE' ? 'มีบิลค้างชำระ กรุณาติดต่อสำนักงาน' : 'บิลของคุณใกล้ครบกำหนดชำระ',
        bill.tenant_id,
        type,
      ],
    );
    queued += result.affectedRows;
  }
  return { queued, checked: bills.length };
}

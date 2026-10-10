import { withTx } from '../db/tx.js';
import { recordAudit } from '../lib/audit.js';

export async function generateDrafts(period, userId) {
  return withTx(async (connection) => {
    const [settingsRows] = await connection.execute('SELECT due_day FROM settings WHERE id = 1');
    const dueDay = settingsRows[0]?.due_day ?? 5;
    const [rooms] = await connection.execute(
      "SELECT id, area_sqm FROM rooms WHERE status = 'Occupied' ORDER BY id FOR UPDATE",
    );
    let generated = 0;
    for (const room of rooms) {
      const [readingRows] = await connection.execute(
        'SELECT utility_type, current_reading, previous_reading FROM meter_readings WHERE room_id = ? AND period = ?',
        [room.id, period],
      );
      const readings = Object.fromEntries(
        readingRows.map((reading) => [reading.utility_type, reading]),
      );
      if (!readings.water || !readings.electric) continue;
      const [rateRows] = await connection.execute(
        "SELECT utility_type, unit_price FROM rates WHERE effective_from <= CAST(? || '-01' AS DATE) ORDER BY effective_from DESC",
        [period],
      );
      const rates = {};
      for (const rate of rateRows)
        if (!rates[rate.utility_type]) rates[rate.utility_type] = rate.unit_price;
      if (!rates.water || !rates.electric || !rates.common) continue;
      const dueDate = new Date(
        Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, dueDay),
      );
      const [[existing]] = await connection.execute(
        'SELECT id, status FROM bills WHERE room_id = ? AND period = ? FOR UPDATE',
        [room.id, period],
      );
      if (existing && existing.status !== 'Draft') continue;
      const [billRows] = await connection.execute(
        "INSERT INTO bills (room_id, period, due_date) VALUES (?, ?, ?) ON CONFLICT (room_id, period) DO UPDATE SET due_date = EXCLUDED.due_date, updated_at = CURRENT_TIMESTAMP WHERE bills.status = 'Draft' RETURNING id",
        [room.id, period, dueDate.toISOString().slice(0, 10)],
      );
      if (!billRows.length) continue;
      const billId = billRows[0].id;
      await connection.execute('DELETE FROM bill_items WHERE bill_id = ?', [billId]);
      const items = [
        [
          'water',
          'ค่าน้ำ',
          readings.water.current_reading,
          readings.water.previous_reading,
          rates.water,
        ],
        [
          'electric',
          'ค่าไฟฟ้า',
          readings.electric.current_reading,
          readings.electric.previous_reading,
          rates.electric,
        ],
        ['common', 'ค่าส่วนกลาง', room.area_sqm, '0', rates.common],
      ];
      for (const [utility, description, current, previous, unitPrice] of items) {
        await connection.execute(
          `INSERT INTO bill_items (bill_id, utility_type, description, quantity, unit_price, amount)
           VALUES (?, ?, ?, CAST(? AS NUMERIC) - CAST(? AS NUMERIC), ?,
             ROUND((CAST(? AS NUMERIC) - CAST(? AS NUMERIC)) * CAST(? AS NUMERIC), 2))`,
          [
            billId,
            utility,
            description,
            current,
            previous,
            unitPrice,
            current,
            previous,
            unitPrice,
          ],
        );
      }
      await connection.execute(
        `UPDATE bills SET subtotal = totals.amount, total = totals.amount
         FROM (SELECT SUM(amount) AS amount FROM bill_items WHERE bill_id = ?) totals
         WHERE bills.id = ?`,
        [billId, billId],
      );
      if (!existing) generated += 1;
    }
    return { generated, period, userId };
  });
}

export async function approveBills(billIds, userId) {
  return withTx(async (connection) => {
    const result = { approved: 0, already_approved: 0, not_found: 0 };
    for (const billId of billIds) {
      const columns = 'id, room_id, period, status, due_date, total, approved_at, approved_by';
      const [[bill]] = await connection.execute(
        `SELECT ${columns} FROM bills WHERE id = ? FOR UPDATE`,
        [billId],
      );
      if (!bill) {
        result.not_found += 1;
        continue;
      }
      if (bill.status !== 'Draft') {
        result.already_approved += 1;
        continue;
      }
      const [[after]] = await connection.execute(
        `UPDATE bills SET status = 'Unpaid', approved_at = CURRENT_TIMESTAMP, approved_by = ?, due_date = GREATEST(due_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date + 3) WHERE id = ? RETURNING ${columns}`,
        [userId, billId],
      );
      await recordAudit(connection, {
        entityType: 'bill',
        entityId: bill.id,
        billId: bill.id,
        action: 'BILL_APPROVE',
        actorUserId: userId,
        before: bill,
        after,
      });
      result.approved += 1;
    }
    return result;
  });
}

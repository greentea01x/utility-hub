import { withTx } from '../db/tx.js';

export async function generateDrafts(period, userId) {
  return withTx(async (connection) => {
    const [settingsRows] = await connection.execute('SELECT due_day FROM settings WHERE id = 1');
    const dueDay = settingsRows[0]?.due_day ?? 5;
    const [rooms] = await connection.execute(
      "SELECT id, area_sqm FROM rooms WHERE status = 'Occupied'",
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
        "SELECT utility_type, unit_price FROM rates WHERE effective_from <= CONCAT(?, '-01') ORDER BY effective_from DESC",
        [period],
      );
      const rates = {};
      for (const rate of rateRows)
        if (!rates[rate.utility_type]) rates[rate.utility_type] = rate.unit_price;
      if (!rates.water || !rates.electric || !rates.common) continue;
      const [billResult] = await connection.execute(
        "INSERT INTO bills (room_id, period, due_date) VALUES (?, ?, LAST_DAY(CONCAT(?, '-01')) - INTERVAL (DAY(LAST_DAY(CONCAT(?, '-01'))) - ?) DAY) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
        [room.id, period, period, period, dueDay],
      );
      const billId = billResult.insertId;
      await connection.execute('DELETE FROM bill_items WHERE bill_id = ?', [billId]);
      const items = [
        [
          'water',
          'ค่าน้ำ',
          Number(readings.water.current_reading) - Number(readings.water.previous_reading),
          rates.water,
        ],
        [
          'electric',
          'ค่าไฟฟ้า',
          Number(readings.electric.current_reading) - Number(readings.electric.previous_reading),
          rates.electric,
        ],
        ['common', 'ค่าส่วนกลาง', Number(room.area_sqm), rates.common],
      ];
      let total = 0;
      for (const [utility, description, quantity, unitPrice] of items) {
        const amount = quantity * Number(unitPrice);
        total += amount;
        await connection.execute(
          'INSERT INTO bill_items (bill_id, utility_type, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)',
          [billId, utility, description, quantity, unitPrice, amount],
        );
      }
      await connection.execute('UPDATE bills SET subtotal = ?, total = ? WHERE id = ?', [
        total,
        total,
        billId,
      ]);
      generated += 1;
    }
    return { generated, period, userId };
  });
}

export async function approveBills(billIds, userId) {
  return withTx(async (connection) => {
    const result = { approved: 0, already_approved: 0, not_found: 0 };
    for (const billId of billIds) {
      const [[bill]] = await connection.execute(
        'SELECT id, status FROM bills WHERE id = ? FOR UPDATE',
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
      await connection.execute(
        "UPDATE bills SET status = 'Unpaid', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?",
        [userId, billId],
      );
      result.approved += 1;
    }
    return result;
  });
}

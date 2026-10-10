import { withTx } from '../db/tx.js';
import { AppError } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';

export async function saveReadings({ roomId, period, values, userId }) {
  return withTx(async (connection) => {
    const [[room]] = await connection.execute(
      'SELECT id, status, water_baseline, electric_baseline FROM rooms WHERE id = ? FOR UPDATE',
      [roomId],
    );
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'ไม่พบห้องพัก');
    if (room.status !== 'Occupied')
      throw new AppError(409, 'ROOM_NOT_OCCUPIED', 'ห้องนี้ไม่มีผู้พักอาศัย');

    const [[bill]] = await connection.execute(
      'SELECT id, status FROM bills WHERE room_id = ? AND period = ? FOR UPDATE',
      [roomId, period],
    );
    if (bill && bill.status !== 'Draft')
      throw new AppError(409, 'READING_LOCKED', 'บิลนี้อนุมัติแล้ว ไม่สามารถแก้เลขมิเตอร์');

    const saved = {};
    for (const [utility, current] of Object.entries(values)) {
      const [previousRows] = await connection.execute(
        'SELECT current_reading FROM meter_readings WHERE room_id = ? AND utility_type = ? AND period < ? ORDER BY period DESC LIMIT 1',
        [roomId, utility, period],
      );
      const previous = Number(
        previousRows[0]?.current_reading ??
          (utility === 'water' ? room.water_baseline : room.electric_baseline),
      );
      if (current < previous)
        throw new AppError(422, 'READING_BELOW_PREVIOUS', 'เลขมิเตอร์ใหม่ต้องไม่น้อยกว่าครั้งก่อน');
      const columns =
        'id, room_id, period, utility_type, previous_reading, current_reading, recorded_by, recorded_at';
      const [[before]] = await connection.execute(
        `SELECT ${columns} FROM meter_readings WHERE room_id = ? AND period = ? AND utility_type = ? FOR UPDATE`,
        [roomId, period, utility],
      );
      if (
        before &&
        Number(before.previous_reading) === previous &&
        Number(before.current_reading) === current
      ) {
        saved[utility] = { units: current - previous };
        continue;
      }
      const [[after]] = await connection.execute(
        `INSERT INTO meter_readings (room_id, period, utility_type, previous_reading, current_reading, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (room_id, period, utility_type) DO UPDATE
         SET previous_reading = EXCLUDED.previous_reading,
             current_reading = EXCLUDED.current_reading,
             recorded_by = EXCLUDED.recorded_by,
             recorded_at = CURRENT_TIMESTAMP RETURNING ${columns}`,
        [roomId, period, utility, previous, current, userId],
      );
      await recordAudit(connection, {
        entityType: 'reading',
        entityId: after.id,
        billId: bill?.id ?? null,
        action: before ? 'READING_EDIT' : 'READING_CREATE',
        actorUserId: userId,
        before: before ?? null,
        after,
      });
      saved[utility] = { units: current - previous };
    }
    return saved;
  });
}

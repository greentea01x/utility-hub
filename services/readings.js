import { withTx } from '../db/tx.js';
import { AppError } from '../lib/errors.js';

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
      'SELECT status FROM bills WHERE room_id = ? AND period = ? FOR UPDATE',
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
      await connection.execute(
        `INSERT INTO meter_readings (room_id, period, utility_type, previous_reading, current_reading, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (room_id, period, utility_type) DO UPDATE
         SET previous_reading = EXCLUDED.previous_reading,
             current_reading = EXCLUDED.current_reading,
             recorded_by = EXCLUDED.recorded_by,
             recorded_at = CURRENT_TIMESTAMP`,
        [roomId, period, utility, previous, current, userId],
      );
      saved[utility] = { units: current - previous };
    }
    return saved;
  });
}

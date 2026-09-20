import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AppError } from '../lib/errors.js';

const router = Router();
const readingInput = z.object({
  room_id: z.coerce.number().int().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  utility_type: z.enum(['water', 'electric']),
  current_reading: z.coerce.number().nonnegative(),
});

router.get('/readings', async (req, res, next) => {
  try {
    const [rooms] = await pool.execute(
      "SELECT id, room_number, water_baseline, electric_baseline FROM rooms WHERE status = 'Occupied' ORDER BY floor, room_number",
    );
    return res.render('pages/readings', {
      title: 'จดมิเตอร์',
      rooms,
      period: req.query.period ?? new Date().toISOString().slice(0, 7),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/api/readings', async (req, res, next) => {
  try {
    const input = readingInput.parse(req.body);
    const [[room]] = await pool.execute(
      'SELECT id, water_baseline, electric_baseline FROM rooms WHERE id = ?',
      [input.room_id],
    );
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'ไม่พบห้องพัก');
    const [previousRows] = await pool.execute(
      'SELECT current_reading FROM meter_readings WHERE room_id = ? AND utility_type = ? ORDER BY period DESC LIMIT 1',
      [input.room_id, input.utility_type],
    );
    const previous =
      previousRows[0]?.current_reading ??
      (input.utility_type === 'water' ? room.water_baseline : room.electric_baseline);
    if (input.current_reading < Number(previous))
      throw new AppError(422, 'READING_BELOW_PREVIOUS', 'เลขมิเตอร์ใหม่ต้องไม่น้อยกว่าครั้งก่อน');
    await pool.execute(
      `INSERT INTO meter_readings (room_id, period, utility_type, previous_reading, current_reading, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE previous_reading = VALUES(previous_reading), current_reading = VALUES(current_reading), recorded_by = VALUES(recorded_by)`,
      [
        input.room_id,
        input.period,
        input.utility_type,
        previous,
        input.current_reading,
        req.session.user.id,
      ],
    );
    return res.status(200).json({
      data: {
        room_id: input.room_id,
        period: input.period,
        utility_type: input.utility_type,
        units: input.current_reading - Number(previous),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลจดมิเตอร์ไม่ถูกต้อง'));
    return next(error);
  }
});

export default router;

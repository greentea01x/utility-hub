import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { saveReadings } from '../services/readings.js';
import { billingPeriod as periodInput } from '../lib/validation.js';

const router = Router();
const readingInput = z.object({
  room_id: z.coerce.number().int().positive(),
  period: periodInput,
  utility_type: z.enum(['water', 'electric']),
  current_reading: z.coerce.number().nonnegative(),
});
const roomReadingInput = z.object({
  period: periodInput,
  water: z.coerce.number().nonnegative(),
  electric: z.coerce.number().nonnegative(),
});

router.get('/readings', async (req, res, next) => {
  try {
    const period = periodInput.parse(req.query.period ?? new Date().toISOString().slice(0, 7));
    const [rooms] = await pool.execute(
      `SELECT r.id, r.room_number,
        COALESCE((SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='water' AND period < ? ORDER BY period DESC LIMIT 1), r.water_baseline) AS water_previous,
        COALESCE((SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='electric' AND period < ? ORDER BY period DESC LIMIT 1), r.electric_baseline) AS electric_previous,
        (SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='water' AND period = ?) AS water_current,
        (SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='electric' AND period = ?) AS electric_current
       FROM rooms r WHERE r.status='Occupied' ORDER BY r.floor, r.room_number`,
      [period, period, period, period],
    );
    return res.render('pages/readings', {
      title: 'จดมิเตอร์',
      rooms,
      period,
      saved: req.query.saved,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});

router.post('/readings/:roomId', async (req, res, next) => {
  try {
    const input = roomReadingInput.parse(req.body);
    const roomId = z.coerce.number().int().positive().parse(req.params.roomId);
    await saveReadings({
      roomId,
      period: input.period,
      values: { water: input.water, electric: input.electric },
      userId: req.session.user.id,
    });
    return res.redirect(`/readings?period=${input.period}&saved=${roomId}`);
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลจดมิเตอร์ไม่ถูกต้อง'));
    return next(error);
  }
});

router.post('/api/readings', async (req, res, next) => {
  try {
    const input = readingInput.parse(req.body);
    const saved = await saveReadings({
      roomId: input.room_id,
      period: input.period,
      values: { [input.utility_type]: input.current_reading },
      userId: req.session.user.id,
    });
    return res.json({
      data: {
        room_id: input.room_id,
        period: input.period,
        utility_type: input.utility_type,
        units: saved[input.utility_type].units,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลจดมิเตอร์ไม่ถูกต้อง'));
    return next(error);
  }
});

export default router;

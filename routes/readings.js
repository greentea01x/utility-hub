import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { currentPeriod } from '../lib/presentation.js';
import { saveReadings } from '../services/readings.js';
import {
  billingPeriod as periodInput,
  technicianName as technicianNameInput,
  technicianNameMessage,
} from '../lib/validation.js';

const router = Router();
const readingInput = z.object({
  room_id: z.coerce.number().int().positive(),
  period: periodInput,
  utility_type: z.enum(['water', 'electric']),
  current_reading: z.coerce.number().nonnegative(),
  technician_name: technicianNameInput,
});
const formReading = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number().nonnegative());
const roomReadingInput = z.object({
  period: periodInput,
  water: formReading,
  electric: formReading,
  technician_name: technicianNameInput,
});
const readingContext = z.object({
  period: periodInput,
  filter: z.enum(['all', 'pending', 'complete', 'vacant']).default('pending'),
  q: z.string().max(10).default(''),
});

async function readingPage({
  period,
  filter,
  q,
  saved = null,
  roomError = null,
  submittedValues = null,
}) {
  const [rooms] = await pool.execute(
    `SELECT r.id, r.room_number, r.floor, r.status, t.full_name AS tenant_name,
        b.status AS bill_status,
        COALESCE((SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='water' AND period < ? ORDER BY period DESC LIMIT 1), r.water_baseline) AS water_previous,
        COALESCE((SELECT current_reading FROM meter_readings WHERE room_id=r.id AND utility_type='electric' AND period < ? ORDER BY period DESC LIMIT 1), r.electric_baseline) AS electric_previous,
        water.current_reading AS water_current,
        water.technician_name AS water_technician_name,
        water.recorded_at AS water_recorded_at,
        electric.current_reading AS electric_current,
        electric.technician_name AS electric_technician_name,
        electric.recorded_at AS electric_recorded_at
       FROM rooms r
       LEFT JOIN tenants t ON t.room_id = r.id AND t.status = 'Active'
       LEFT JOIN meter_readings water ON water.room_id = r.id AND water.utility_type = 'water' AND water.period = ?
       LEFT JOIN meter_readings electric ON electric.room_id = r.id AND electric.utility_type = 'electric' AND electric.period = ?
       LEFT JOIN bills b ON b.room_id = r.id AND b.period = ?
       WHERE r.status IN ('Occupied','Vacant') ORDER BY r.floor, r.room_number`,
    [period, period, period, period, period],
  );
  for (const room of rooms) room.locked = room.bill_status !== null && room.bill_status !== 'Draft';
  const complete = (room) => room.water_current !== null && room.electric_current !== null;
  const occupied = rooms.filter((room) => room.status === 'Occupied');
  const counts = {
    all: occupied.length,
    complete: occupied.filter(complete).length,
    pending: occupied.filter((room) => !complete(room)).length,
    vacant: rooms.filter((room) => room.status === 'Vacant').length,
  };
  const filteredRooms = rooms.filter((room) => {
    if (roomError && String(room.id) === String(roomError.roomId)) return true;
    if (!room.room_number.startsWith(q)) return false;
    if (filter === 'vacant') return room.status === 'Vacant';
    return (
      room.status === 'Occupied' &&
      (filter === 'all' || (filter === 'complete' ? complete(room) : !complete(room)))
    );
  });
  return {
    title: 'จดมิเตอร์',
    rooms: filteredRooms,
    counts,
    filter,
    q,
    period,
    saved,
    roomError,
    submittedValues,
  };
}

router.get('/readings', async (req, res, next) => {
  try {
    const context = readingContext.parse({
      ...req.query,
      period: req.query.period ?? currentPeriod(),
    });
    return res.render('pages/readings', await readingPage({ ...context, saved: req.query.saved }));
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});

router.post('/readings/:roomId', async (req, res, next) => {
  let context;
  let roomId;
  try {
    context = readingContext.parse(req.body);
    roomId = z.coerce.number().int().positive().parse(req.params.roomId);
    const input = roomReadingInput.parse(req.body);
    await saveReadings({
      roomId,
      period: input.period,
      values: { water: input.water, electric: input.electric },
      userId: req.session.user.id,
      technicianName: input.technician_name,
    });
    const query = new URLSearchParams({
      period: input.period,
      filter: 'all',
      q: context.q,
      saved: String(roomId),
    });
    return res.redirect(`/readings?${query}`);
  } catch (error) {
    if (
      context &&
      roomId &&
      (error.status === 422 || error.code === 'READING_LOCKED' || error instanceof z.ZodError)
    ) {
      try {
        const message =
          error instanceof z.ZodError
            ? error.issues.some((issue) => issue.path[0] === 'technician_name')
              ? technicianNameMessage
              : 'กรุณากรอกเลขมิเตอร์ให้ครบและถูกต้อง'
            : error.message;
        const inputText = (value) =>
          typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 100) : '';
        const page = await readingPage({
          ...context,
          roomError: { roomId, message },
          submittedValues: {
            water: inputText(req.body.water),
            electric: inputText(req.body.electric),
            technician_name:
              typeof req.body.technician_name === 'string'
                ? req.body.technician_name.slice(0, 1000)
                : '',
          },
        });
        return res.status(error.status ?? 422).render('pages/readings', page);
      } catch (renderError) {
        return next(renderError);
      }
    }
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
      technicianName: input.technician_name,
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
    if (error instanceof z.ZodError) {
      const nameInvalid = error.issues.some((issue) => issue.path[0] === 'technician_name');
      return next(
        new AppError(
          422,
          'VALIDATION_FAILED',
          nameInvalid ? technicianNameMessage : 'ข้อมูลจดมิเตอร์ไม่ถูกต้อง',
          nameInvalid ? { technician_name: technicianNameMessage } : undefined,
        ),
      );
    }
    return next(error);
  }
});

export default router;

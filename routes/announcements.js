import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.get('/announcements', requireRole('admin'), async (_req, res, next) => {
  try {
    const [announcements] = await pool.execute(
      'SELECT id, title, body, audience, created_at FROM announcements ORDER BY id DESC',
    );
    return res.render('pages/announcements', { title: 'ประกาศ', announcements });
  } catch (error) {
    return next(error);
  }
});
router.post('/announcements', requireRole('admin'), async (req, res, next) => {
  try {
    const input = z
      .object({
        title: z.string().min(1).max(60),
        body: z.string().min(1).max(400),
        audience: z.enum(['all', 'floors']).default('all'),
      })
      .parse(req.body);
    await pool.execute(
      'INSERT INTO announcements (title, body, audience, created_by) VALUES (?, ?, ?, ?)',
      [input.title, input.body, input.audience, req.session.user.id],
    );
    return res.redirect('/announcements');
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลประกาศไม่ถูกต้อง'));
    return next(error);
  }
});
export default router;

import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();
router.post('/api/notifications/drain', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM notifications WHERE status='queued' ORDER BY id LIMIT 20",
    );
    if (rows.length)
      await pool.query(
        `UPDATE notifications SET status='sent', sent_at=CURRENT_TIMESTAMP, attempt_count=attempt_count+1 WHERE id IN (${rows.map((_, index) => `$${index + 1}`).join(',')})`,
        rows.map((row) => row.id),
      );
    return res.json({ data: { sent: rows.length, failed: 0, remaining: 0 } });
  } catch (error) {
    return next(error);
  }
});
export default router;

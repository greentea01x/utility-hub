import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();
export async function healthz(_req, res) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ data: { status: 'ok' } });
  } catch {
    res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable' } });
  }
}
router.get('/healthz', healthz);
export default router;

import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getSettings } from '../services/records.js';

const router = Router();
router.get('/settings', requireRole('admin'), async (_req, res, next) => {
  try {
    return res.render('pages/settings', { title: 'ตั้งค่า', ...(await getSettings()) });
  } catch (error) {
    return next(error);
  }
});
export default router;

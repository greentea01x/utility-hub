import { Router } from 'express';
import { readingSummary } from '../services/reports.js';

const router = Router();
router.get(['/', '/dashboard'], async (req, res, next) => {
  try {
    const summary =
      req.session.user.role === 'staff'
        ? await readingSummary(new Date().toISOString().slice(0, 7))
        : null;
    return res.render('pages/dashboard', { title: 'ภาพรวม', summary });
  } catch (error) {
    return next(error);
  }
});
export default router;

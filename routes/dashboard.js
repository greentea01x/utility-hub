import { Router } from 'express';
import { readingSummary, dashboardOverview } from '../services/reports.js';
import { billingPeriod } from '../lib/validation.js';
import { currentPeriod } from '../lib/presentation.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const router = Router();
router.get(['/', '/dashboard'], async (req, res, next) => {
  try {
    const period = billingPeriod.parse(req.query.period ?? currentPeriod());
    const summary = req.session.user.role === 'staff' ? await readingSummary(period) : null;
    const overview = summary ? null : await dashboardOverview(period);
    return res.render('pages/dashboard', { title: 'ภาพรวม', summary, overview, period });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
export default router;

import { Router } from 'express';
import { z } from 'zod';
import { dashboardSummary, readingSummary, arrearsReport } from '../services/reports.js';
import { billingPeriod } from '../lib/validation.js';
import { AppError } from '../lib/errors.js';

const router = Router();
const csv = (rows) =>
  `\ufeff${['ห้อง,ผู้พักอาศัย,ยอดค้าง,ครบกำหนด', ...rows.map((row) => [row.room_number, row.full_name ?? '', row.total, row.due_date].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')}`;
router.get(['/api/dashboard/summary', '/api/dashboard/charts'], async (req, res, next) => {
  try {
    return res.json({
      data: await (req.session.user.role === 'staff' ? readingSummary : dashboardSummary)(
        billingPeriod.parse(req.query.period ?? new Date().toISOString().slice(0, 7)),
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
router.get('/reports/arrears', async (req, res, next) => {
  try {
    const period = billingPeriod.parse(req.query.period ?? new Date().toISOString().slice(0, 7));
    const rows = await arrearsReport(period);
    if (req.query.format === 'csv') return res.type('text/csv').send(csv(rows));
    return res.render('pages/report', { title: 'รายงานลูกหนี้ค้างชำระ', period, rows });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
export default router;

import { Router } from 'express';
import { dashboardSummary, arrearsReport } from '../services/reports.js';

const router = Router();
const csv = (rows) =>
  `\ufeff${['ห้อง,ผู้พักอาศัย,ยอดค้าง,ครบกำหนด', ...rows.map((row) => [row.room_number, row.full_name ?? '', row.total, row.due_date].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')}`;
router.get(['/api/dashboard/summary', '/api/dashboard/charts'], async (req, res, next) => {
  try {
    return res.json({
      data: await dashboardSummary(req.query.period ?? new Date().toISOString().slice(0, 7)),
    });
  } catch (error) {
    return next(error);
  }
});
router.get('/reports/arrears', async (req, res, next) => {
  try {
    const period = req.query.period ?? new Date().toISOString().slice(0, 7);
    const rows = await arrearsReport(period);
    if (req.query.format === 'csv') return res.type('text/csv').send(csv(rows));
    return res.render('pages/report', { title: 'รายงานลูกหนี้ค้างชำระ', period, rows });
  } catch (error) {
    return next(error);
  }
});
export default router;

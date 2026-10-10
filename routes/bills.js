import { Router } from 'express';
import { z } from 'zod';
import pool from '../db/pool.js';
import { approveBills, generateDrafts } from '../services/billing.js';
import { AppError } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { billingPeriod } from '../lib/validation.js';

const router = Router();
router.use(['/bills', '/api/bills'], requireRole('admin'));
router.get('/bills', async (req, res, next) => {
  try {
    const period = billingPeriod.parse(req.query.period ?? new Date().toISOString().slice(0, 7));
    const [bills] = await pool.execute(
      `SELECT b.id, r.room_number, b.period, b.status, b.total, b.due_date, receipt.id AS receipt_id
       FROM bills b JOIN rooms r ON r.id=b.room_id
       LEFT JOIN payments p ON p.bill_id=b.id
       LEFT JOIN receipts receipt ON receipt.payment_id=p.id
       WHERE b.period = ? ORDER BY r.room_number`,
      [period],
    );
    return res.render('pages/bills', { title: 'บิลรายเดือน', bills, period });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
router.post('/bills/generate', async (req, res, next) => {
  try {
    const { period } = z.object({ period: billingPeriod }).parse(req.body);
    await generateDrafts(period, req.session.user.id);
    return res.redirect(`/bills?period=${period}`);
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
router.post('/bills/:id/approve', requireRole('admin'), async (req, res, next) => {
  try {
    const billId = z.coerce.number().int().positive().parse(req.params.id);
    const period = billingPeriod.parse(req.body.period);
    await approveBills([billId], req.session.user.id);
    return res.redirect(`/bills?period=${period}`);
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลบิลไม่ถูกต้อง'));
    return next(error);
  }
});
router.post('/api/bills/generate', async (req, res, next) => {
  try {
    const { period } = z.object({ period: billingPeriod }).parse(req.body);
    return res.json({ data: await generateDrafts(period, req.session.user.id) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'รอบบิลไม่ถูกต้อง'));
    return next(error);
  }
});
router.post('/api/bills/approve', requireRole('admin'), async (req, res, next) => {
  try {
    const { bill_ids: billIds } = z
      .object({ bill_ids: z.array(z.coerce.number().int().positive()).min(1).max(200) })
      .parse(req.body);
    return res.json({ data: await approveBills(billIds, req.session.user.id) });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'เลือกบิลที่ต้องการอนุมัติ'));
    return next(error);
  }
});
export default router;

import { Router } from 'express';
import pool from '../db/pool.js';
import { z } from 'zod';
import { billingPeriod } from '../lib/validation.js';
import { currentPeriod } from '../lib/presentation.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.get('/reports', (_req, res) => res.render('pages/reports', { title: 'รายงาน' }));
router.get('/users', async (_req, res, next) => {
  try {
    const { rows: users } = await pool.query(
      'SELECT id, username, display_name, role, status FROM users ORDER BY id',
    );
    return res.render('pages/users', { title: 'ผู้ใช้งานระบบ', users });
  } catch (error) {
    return next(error);
  }
});
router.get(['/payments', '/payments/history'], async (req, res, next) => {
  try {
    const q = z
      .string()
      .max(50)
      .parse(req.query.q ?? '');
    const history = req.path === '/payments/history';
    const period = history ? billingPeriod.parse(req.query.period ?? currentPeriod()) : null;
    const { rows } = history
      ? await pool.query(
          `SELECT p.id, p.amount, p.received_at, p.voided_at, p.void_reason, b.period, r.room_number,
        receipt.id AS receipt_id, receipt.receipt_number, u.display_name AS received_by
       FROM payments p JOIN bills b ON b.id = p.bill_id JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = p.received_by LEFT JOIN receipts receipt ON receipt.payment_id = p.id
       WHERE p.received_at >= ($1 || '-01')::timestamp AT TIME ZONE 'Asia/Bangkok'
         AND p.received_at < (($1 || '-01')::date + interval '1 month')::timestamp AT TIME ZONE 'Asia/Bangkok'
         AND (r.room_number LIKE $2 OR receipt.receipt_number = $3)
       ORDER BY p.received_at DESC, p.id DESC`,
          [period, `${q}%`, q],
        )
      : await pool.query(
          `SELECT b.id, b.period, b.total, b.due_date, r.room_number
       FROM bills b JOIN rooms r ON r.id = b.room_id
       WHERE b.status = 'Unpaid' AND r.room_number LIKE $1 ORDER BY b.due_date, r.room_number`,
          [`${q}%`],
        );
    return res.render('pages/payments', { title: 'รับชำระเงิน', rows, q, history, period });
  } catch (error) {
    if (error instanceof z.ZodError)
      return next(new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลค้นหาไม่ถูกต้อง'));
    return next(error);
  }
});
export default router;

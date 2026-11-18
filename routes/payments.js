import { Router } from 'express';
import { confirmPayment } from '../services/payment.js';
import pool from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
router.use(['/receipts', '/bills', '/api/bills'], requireRole('admin'));
router.get('/receipts/:id', async (req, res, next) => {
  try {
    const [[receipt]] = await pool.execute(
      `SELECT r.receipt_number, p.amount, p.received_at, b.id AS bill_id, b.period, rm.room_number, t.full_name
      FROM receipts r JOIN payments p ON p.id=r.payment_id JOIN bills b ON b.id=p.bill_id
      JOIN rooms rm ON rm.id=b.room_id LEFT JOIN tenants t ON t.room_id=rm.id AND t.status='Active' WHERE r.id=?`,
      [req.params.id],
    );
    if (!receipt) return res.status(404).render('pages/errors/404', { title: 'ไม่พบใบเสร็จ' });
    const [items] = await pool.execute(
      `SELECT description, quantity, unit_price, amount FROM bill_items
       WHERE bill_id = ? ORDER BY CASE utility_type WHEN 'water' THEN 1 WHEN 'electric' THEN 2 ELSE 3 END`,
      [receipt.bill_id],
    );
    return res.render('pages/receipt', { title: 'ใบเสร็จรับเงิน', receipt, items });
  } catch (error) {
    return next(error);
  }
});
router.post('/api/bills/:id/confirm-payment', async (req, res, next) => {
  try {
    return res.json({ data: await confirmPayment(Number(req.params.id), req.session.user.id) });
  } catch (error) {
    return next(error);
  }
});
router.post('/bills/:id/pay', async (req, res, next) => {
  try {
    const billId = Number(req.params.id);
    const payment = await confirmPayment(billId, req.session.user.id);
    return res.redirect(`/receipts/${payment.receipt_id}`);
  } catch (error) {
    return next(error);
  }
});
export default router;

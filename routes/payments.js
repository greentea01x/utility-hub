import { Router } from 'express';
import { confirmPayment } from '../services/payment.js';

const router = Router();
router.post('/api/bills/:id/confirm-payment', async (req, res, next) => {
  try {
    return res.json({ data: await confirmPayment(Number(req.params.id), req.session.user.id) });
  } catch (error) {
    return next(error);
  }
});
export default router;

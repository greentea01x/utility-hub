import { Router } from 'express';

const router = Router();
router.get(['/', '/dashboard'], (_req, res) => res.render('pages/dashboard', { title: 'ภาพรวม' }));
export default router;

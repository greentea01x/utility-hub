import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listTenants } from '../services/records.js';

const router = Router();
router.get('/tenants', requireRole('admin'), async (req, res, next) => {
  try {
    return res.render('pages/tenants', {
      title: 'ผู้พักอาศัย',
      tenants: await listTenants({
        status: req.query.status ?? 'active',
        query: req.query.q ?? '',
      }),
    });
  } catch (error) {
    return next(error);
  }
});
export default router;

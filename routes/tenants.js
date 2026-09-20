import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listTenants } from '../services/records.js';
import { createLinkCode } from '../services/linking.js';

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
router.post('/tenants/:id/link-code', requireRole('admin'), async (req, res, next) => {
  try {
    const code = await createLinkCode(Number(req.params.id));
    return res.status(200).json({ data: { code } });
  } catch (error) {
    return next(error);
  }
});
export default router;

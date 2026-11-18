import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listRooms } from '../services/records.js';

const router = Router();
router.get('/rooms', async (req, res, next) => {
  try {
    return res.render('pages/rooms', { title: 'ห้องพัก', ...(await listRooms(req.query)) });
  } catch (error) {
    return next(error);
  }
});
router.get('/rooms/new', requireRole('admin'), (_req, res) =>
  res.status(501).send('เพิ่มห้องพักจะเปิดในขั้นถัดไป'),
);
export default router;

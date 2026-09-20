import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../db/pool.js';

const credentials = z.object({ username: z.string().min(1), password: z.string().min(1) });
const router = Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  return res.render('pages/login', { title: 'เข้าสู่ระบบ', username: '' });
});

router.post('/login', async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    const [rows] = await pool.execute(
      "SELECT id, username, display_name, password_hash, role FROM users WHERE username = ? AND status = 'Active'",
      [input.username],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(200).render('pages/login', {
        title: 'เข้าสู่ระบบ',
        username: input.username,
        error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }
    const identity = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = identity;
      return req.session.save((saveError) =>
        saveError ? next(saveError) : res.redirect('/dashboard'),
      );
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(422).render('pages/login', {
        title: 'เข้าสู่ระบบ',
        username: req.body.username ?? '',
        error: 'กรอกชื่อผู้ใช้และรหัสผ่าน',
      });
    return next(error);
  }
});

router.post('/logout', (req, res, next) =>
  req.session.destroy((error) => (error ? next(error) : res.redirect('/login'))),
);

export default router;

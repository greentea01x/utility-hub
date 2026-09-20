import { AppError } from '../lib/errors.js';

export function requireAuth(req, _res, next) {
  if (req.session?.user) return next();
  return next(new AppError(401, 'AUTH_REQUIRED', 'กรุณาเข้าสู่ระบบ'));
}

export function requireRole(...roles) {
  return (req, _res, next) =>
    roles.includes(req.session.user.role)
      ? next()
      : next(new AppError(403, 'ROLE_FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'));
}

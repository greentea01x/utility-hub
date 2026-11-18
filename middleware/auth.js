import { AppError } from '../lib/errors.js';
import { canAccess, navigationFor } from '../lib/permissions.js';

const loadOperator = async (id) => {
  const { default: pool } = await import('../db/pool.js');
  const [[user]] = await pool.execute(
    'SELECT id, username, display_name, role, status FROM users WHERE id = ?',
    [id],
  );
  return user;
};

export function createRequireAuth({ loadUser = loadOperator } = {}) {
  return async (req, _res, next) => {
    const id = req.session?.user?.id;
    const validId =
      (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
      (typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id));
    if (!validId) {
      if (req.session) delete req.session.user;
      return next(new AppError(401, 'AUTH_REQUIRED', 'กรุณาเข้าสู่ระบบ'));
    }
    let user;
    try {
      user = await loadUser(id);
    } catch {
      return next(
        new AppError(503, 'DB_UNAVAILABLE', 'ไม่สามารถตรวจสอบสิทธิ์ผู้ใช้งานได้ กรุณาลองอีกครั้ง'),
      );
    }
    if (
      !user ||
      String(user.id) !== String(id) ||
      user.status !== 'Active' ||
      !['admin', 'staff'].includes(user.role)
    ) {
      // express-session persists this removal before the 401/redirect response.
      delete req.session.user;
      return next(new AppError(401, 'AUTH_REQUIRED', 'กรุณาเข้าสู่ระบบ'));
    }
    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    return next();
  };
}

export const requireAuth = createRequireAuth();

export function requireRole(...roles) {
  return (req, _res, next) =>
    roles.includes(req.session?.user?.role)
      ? next()
      : next(new AppError(403, 'ROLE_FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'));
}

export function requirePageAccess(req, res, next) {
  const role = req.session.user.role;
  if (!canAccess(role, req.path, req.method))
    return next(new AppError(403, 'ROLE_FORBIDDEN', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'));
  res.locals.navigation = navigationFor(role);
  res.locals.canAccess = (path) => canAccess(role, path);
  return next();
}

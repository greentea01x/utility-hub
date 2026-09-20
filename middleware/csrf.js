import crypto from 'node:crypto';
import { AppError } from '../lib/errors.js';

const tokenKey = 'csrfToken';

export function csrf(req, res, next) {
  if (!req.session) return next();
  if (!req.session[tokenKey]) req.session[tokenKey] = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session[tokenKey];
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const actual = req.get('x-csrf-token') ?? req.body?._csrf;
  const expected = req.session[tokenKey];
  if (!actual || actual.length !== expected.length)
    return next(new AppError(403, 'CSRF_INVALID', 'คำขอไม่ถูกต้อง'));
  const valid = crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  return valid ? next() : next(new AppError(403, 'CSRF_INVALID', 'คำขอไม่ถูกต้อง'));
}

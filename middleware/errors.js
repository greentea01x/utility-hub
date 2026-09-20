import { log } from '../lib/log.js';

export function notFound(req, _res, next) {
  const error = new Error('ไม่พบหน้าที่ต้องการ');
  error.status = 404;
  next(error);
}

export function errors(error, req, res, _next) {
  const status = error.status ?? 500;
  log('error', error.message, { status, path: req.path });
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message,
        fields: error.fields,
      },
    });
  }
  if (status === 401) return res.redirect('/login');
  return res
    .status(status)
    .render(`pages/errors/${status === 403 ? '403' : status === 404 ? '404' : '500'}`, {
      title: 'เกิดข้อผิดพลาด',
    });
}

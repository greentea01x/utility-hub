import crypto from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { residentConfig, verifyLineIdToken } from '../services/line-identity.js';
import { AppError } from '../lib/errors.js';

const loadResidentData = async (lineUserId) => (await import('../services/resident.js')).loadResidentData(lineUserId);

export function createResidentRouter({ config = () => residentConfig(), verify = verifyLineIdToken, load = loadResidentData } = {}) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); });
  router.get('/config', (req, res) => {
    const current = config();
    res.json({ enabled: current.enabled, liffId: current.enabled ? current.liffId : '', csrfToken: req.session.csrfToken });
  });
  router.use((_req, _res, next) => config().enabled ? next() : next(new AppError(503, 'LINE_NOT_CONFIGURED', 'สำนักงานกำลังตั้งค่าบริการลูกบ้านผ่าน LINE')));
  router.post('/session', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res, next) => {
    try {
      const identity = await verify(req.body?.idToken, { channelId: config().channelId });
      await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.resident = identity;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
      let linked = true;
      try { await load(identity.lineUserId); } catch (error) { if (error.code === 'NOT_LINKED') linked = false; else throw error; }
      res.json({ linked, csrfToken: req.session.csrfToken });
    } catch (error) { next(error); }
  });
  router.use((req, _res, next) => {
    const identity = req.session.resident;
    if (!identity || typeof identity.lineUserId !== 'string' || !Number.isFinite(identity.expiresAt) || identity.expiresAt <= Date.now())
      return next(new AppError(401, 'RESIDENT_LOGIN_REQUIRED', 'กรุณาเปิดบริการลูกบ้านผ่าน LINE อีกครั้ง'));
    next();
  });
  router.get('/data', async (req, res, next) => {
    try { res.json(await load(req.session.resident.lineUserId)); } catch (error) { next(error); }
  });
  router.post('/logout', (req, res, next) => req.session.destroy(error => error ? next(error) : res.sendStatus(204)));
  router.use((error, _req, res, _next) => {
    const status = error instanceof AppError ? error.status : 503;
    res.status(status).json({ error: { code: error instanceof AppError ? error.code : 'SERVICE_UNAVAILABLE', message: error instanceof AppError ? error.message : 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง' } });
  });
  return router;
}

export default createResidentRouter();

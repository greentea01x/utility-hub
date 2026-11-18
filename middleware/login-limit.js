import { rateLimit } from 'express-rate-limit';

export function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skip: (req) => req.method !== 'POST',
    skipSuccessfulRequests: true,
    // Invalid credentials render the login form with HTTP 200. Only the
    // successful login redirect should remove an attempt from this counter.
    requestWasSuccessful: (_req, res) => res.statusCode === 302,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: 'เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณาลองอีกครั้งใน 15 นาที',
  });
}

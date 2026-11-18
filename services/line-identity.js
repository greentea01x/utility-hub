import { AppError } from '../lib/errors.js';
import { isIP } from 'node:net';

export function residentConfig(env = process.env) {
  const liffId = env.LIFF_ID?.trim() ?? '';
  const channelId = env.LINE_LOGIN_CHANNEL_ID?.trim() ?? '';
  let origin = '';
  try {
    const url = new URL(env.PUBLIC_BASE_URL);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && host.includes('.') && !host.endsWith('.local') && !host.endsWith('.localhost') && !isIP(host)) origin = url.origin;
  } catch { /* Missing configuration keeps the portal closed. */ }
  return {
    enabled: Boolean(origin && /^\d{6,}-[A-Za-z0-9_-]+$/.test(liffId) && /^\d{6,}$/.test(channelId)),
    liffId, channelId, origin,
  };
}

export async function verifyLineIdToken(idToken, { channelId, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!channelId) throw new AppError(503, 'LINE_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบ LINE');
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 10000)
    throw new AppError(401, 'LINE_TOKEN_INVALID', 'กรุณาเข้าสู่ระบบ LINE ใหม่');
  let response;
  try {
    response = await fetchImpl('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
  } catch {
    throw new AppError(503, 'LINE_UNAVAILABLE', 'ไม่สามารถตรวจสอบบัญชี LINE ได้ กรุณาลองอีกครั้ง');
  }
  if (response.status === 429 || response.status >= 500)
    throw new AppError(503, 'LINE_UNAVAILABLE', 'LINE ยังไม่พร้อมให้บริการ กรุณาลองอีกครั้ง');
  if (!response.ok) throw new AppError(401, 'LINE_TOKEN_INVALID', 'กรุณาเข้าสู่ระบบ LINE ใหม่');
  let identity;
  try { identity = await response.json(); } catch { throw new AppError(503, 'LINE_UNAVAILABLE', 'ไม่สามารถตรวจสอบบัญชี LINE ได้'); }
  const seconds = Math.floor(now / 1000);
  if (!identity || identity.iss !== 'https://access.line.me' || String(identity.aud) !== channelId ||
      !/^U[0-9a-f]{32}$/.test(identity.sub) || !Number.isFinite(identity.exp) || identity.exp <= seconds ||
      !Number.isFinite(identity.iat) || identity.iat > seconds + 60)
    throw new AppError(401, 'LINE_TOKEN_INVALID', 'กรุณาเข้าสู่ระบบ LINE ใหม่');
  return { lineUserId: identity.sub, expiresAt: Math.min(identity.exp * 1000, now + 60 * 60 * 1000) };
}

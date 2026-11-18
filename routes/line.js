import crypto from 'node:crypto';
import { Router } from 'express';

const consumeCode = async (code, userId) => {
  const { consumeLinkCode } = await import('../services/linking.js');
  return consumeLinkCode(code, userId);
};

export function createLineWebhookHandler({
  getSecret = () => process.env.LINE_CHANNEL_SECRET,
  consumeLinkCode = consumeCode,
} = {}) {
  return async (req, res) => {
    const secret = getSecret();
    if (typeof secret !== 'string' || !secret.trim()) return res.sendStatus(503);
    if (!Buffer.isBuffer(req.body)) return res.sendStatus(400);
    const signature = req.get('x-line-signature') ?? '';
    if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) return res.sendStatus(401);
    const actual = Buffer.from(signature, 'base64');
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest();
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected))
      return res.sendStatus(401);

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.events))
      return res.sendStatus(400);

    try {
      for (const event of payload.events) {
        if (
          event?.type !== 'message' ||
          event.source?.type !== 'user' ||
          typeof event.source.userId !== 'string' ||
          !/^U[0-9a-f]{32}$/i.test(event.source.userId) ||
          event.message?.type !== 'text' ||
          typeof event.message.text !== 'string'
        )
          continue;
        const code = event.message.text.trim().toUpperCase();
        if (/^[A-F0-9]{6}$/.test(code)) await consumeLinkCode(code, event.source.userId);
      }
    } catch {
      // Acknowledge only completed processing so LINE can redeliver transient failures.
      return res.sendStatus(503);
    }
    return res.sendStatus(200);
  };
}

export function createLineRouter(options) {
  const router = Router();
  router.post('/webhook', createLineWebhookHandler(options));
  return router;
}

export default createLineRouter();

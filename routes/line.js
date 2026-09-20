import crypto from 'node:crypto';
import { Router } from 'express';
import { consumeLinkCode } from '../services/linking.js';

const router = Router();
router.post('/webhook', async (req, res) => {
  const signature = req.get('x-line-signature') ?? '';
  const expected = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET ?? '')
    .update(req.body)
    .digest('base64');
  if (
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return res.sendStatus(401);
  res.sendStatus(200);
  const payload = JSON.parse(req.body.toString('utf8'));
  for (const event of payload.events ?? []) {
    const text = event.message?.text?.trim();
    if (event.source?.userId && text) await consumeLinkCode(text, event.source.userId);
  }
});
export default router;

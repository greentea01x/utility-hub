import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('csrf tokens compare byte-for-byte', () => {
  const token = crypto.randomBytes(32).toString('hex');
  assert.equal(crypto.timingSafeEqual(Buffer.from(token), Buffer.from(token)), true);
  const other = `${token[0] === '0' ? '1' : '0'}${token.slice(1)}`;
  assert.equal(crypto.timingSafeEqual(Buffer.from(token), Buffer.from(other)), false);
});

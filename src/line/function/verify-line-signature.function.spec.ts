import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyLineSignature } from './verify-line-signature.function.js';

const SECRET = 'test-channel-secret';
// what LINE sends for the console's "Verify" button
const BODY = Buffer.from('{"destination":"U0123456789abcdef0123456789abcdef","events":[]}');
const sign = (body: Buffer, secret = SECRET) =>
  createHmac('sha256', secret).update(body).digest('base64');

describe('verifyLineSignature', () => {
  it('accepts the signature of the exact body', () => {
    expect(verifyLineSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('rejects a body that was changed after signing', () => {
    const changed = Buffer.from(BODY.toString().replace('[]', '[{}]'));
    expect(verifyLineSignature(changed, sign(BODY), SECRET)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    expect(verifyLineSignature(BODY, sign(BODY, 'other'), SECRET)).toBe(false);
  });

  it('rejects a missing body or signature', () => {
    expect(verifyLineSignature(undefined, sign(BODY), SECRET)).toBe(false);
    expect(verifyLineSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyLineSignature(BODY, 'not-base64!', SECRET)).toBe(false);
  });
});

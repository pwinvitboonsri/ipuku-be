import { createHmac, timingSafeEqual } from 'node:crypto';

// LINE signs each webhook: base64(HMAC-SHA256(channel secret, exact request body)).
// Must run on the raw bytes; re-serialised JSON would not match.
export function verifyLineSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  channelSecret: string,
): boolean {
  if (!rawBody || !signature) return false;

  const expected = createHmac('sha256', channelSecret).update(rawBody).digest();
  const given = Buffer.from(signature, 'base64');

  return given.length === expected.length && timingSafeEqual(given, expected);
}

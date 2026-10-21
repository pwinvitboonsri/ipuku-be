import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeCode } from './loyalty-codes.function.js';

// The reward QR in LINE changes every period: "IPKR1.<code>.<token>", token = HMAC(seed, window).
// A screenshot stops working after one period; the LIFF app computes the same token from the seed.
export const REWARD_QR_PERIOD_S = 15;
const PREFIX = 'IPKR1';

export function rewardWindow(nowMs: number): number {
  return Math.floor(nowMs / 1000 / REWARD_QR_PERIOD_S);
}

// 6 digits from HMAC-SHA256(key = seed hex bytes, message = window as decimal text)
export function rewardToken(seed: string, window: number): string {
  const mac = createHmac('sha256', Buffer.from(seed, 'hex')).update(String(window)).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

// Current window plus one either side, for clock drift between phone and server
export function verifyRewardToken(seed: string, token: string, nowMs: number): boolean {
  const w = rewardWindow(nowMs);
  return [w - 1, w, w + 1].some((x) => {
    const expected = Buffer.from(rewardToken(seed, x));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

export function rewardQrPayload(code: string, token: string): string {
  return `${PREFIX}.${code}.${token}`;
}

// A scanned QR ("IPKR1.K7P29X.123456") or a typed fallback code ("K7P 29X").
// token is null for a typed code; null overall if it's neither.
export function parseRewardInput(input: string): { code: string; token: string | null } | null {
  const trimmed = input.trim();
  const parts = trimmed.split('.');
  if (parts[0] === PREFIX) {
    const code = parts.length === 3 ? normalizeCode(parts[1]) : null;
    return code && /^\d{6}$/.test(parts[2]) ? { code, token: parts[2] } : null;
  }
  const code = normalizeCode(trimmed);
  return code ? { code, token: null } : null;
}

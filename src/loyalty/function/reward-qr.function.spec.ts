import { describe, expect, it } from 'vitest';
import { REWARD_QR_PERIOD_S, parseRewardInput, rewardQrPayload, rewardToken, rewardWindow, verifyRewardToken } from './reward-qr.function.js';

const seed = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const t0 = 1_760_000_000_000;

describe('reward QR', () => {
  it('makes a 6-digit token that changes each period', () => {
    const w = rewardWindow(t0);
    expect(rewardToken(seed, w)).toMatch(/^\d{6}$/);
    expect(rewardToken(seed, w)).toBe(rewardToken(seed, w));
    expect(rewardToken(seed, w)).not.toBe(rewardToken(seed, w + 1));
  });

  it('accepts the current and neighbouring windows only', () => {
    const p = REWARD_QR_PERIOD_S * 1000;
    const token = rewardToken(seed, rewardWindow(t0));
    expect(verifyRewardToken(seed, token, t0)).toBe(true);
    expect(verifyRewardToken(seed, token, t0 + p)).toBe(true);
    expect(verifyRewardToken(seed, token, t0 + 3 * p)).toBe(false);
    expect(verifyRewardToken(seed, '000000', t0)).toBe(rewardToken(seed, rewardWindow(t0)) === '000000');
  });

  it('parses a scanned QR or a typed code', () => {
    expect(parseRewardInput(rewardQrPayload('K7P29X', '123456'))).toEqual({ code: 'K7P29X', token: '123456' });
    expect(parseRewardInput('k7p 29x')).toEqual({ code: 'K7P29X', token: null });
    expect(parseRewardInput('IPKR1.K7P29X.12345')).toBeNull();
    expect(parseRewardInput('https://example.com')).toBeNull();
  });
});

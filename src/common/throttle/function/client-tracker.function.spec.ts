import { describe, expect, it } from 'vitest';
import { resolveClientTracker } from './client-tracker.function.js';

const KEY = 'k'.repeat(32);

describe('resolveClientTracker', () => {
  it('uses the forwarded client IP when the BFF key matches', () => {
    expect(resolveClientTracker({ 'x-bff-key': KEY, 'x-client-ip': '1.2.3.4' }, '10.0.0.1', KEY)).toBe('1.2.3.4');
  });

  it('ignores the forwarded IP when the key is wrong', () => {
    expect(resolveClientTracker({ 'x-bff-key': 'x'.repeat(32), 'x-client-ip': '1.2.3.4' }, '10.0.0.1', KEY)).toBe(
      '10.0.0.1',
    );
  });

  it('ignores the forwarded IP when the key is missing', () => {
    expect(resolveClientTracker({ 'x-client-ip': '1.2.3.4' }, '10.0.0.1', KEY)).toBe('10.0.0.1');
  });

  it('ignores headers when no BFF key is configured', () => {
    expect(resolveClientTracker({ 'x-bff-key': '', 'x-client-ip': '1.2.3.4' }, '10.0.0.1', '')).toBe('10.0.0.1');
  });

  it('falls back to the socket IP when the client IP is absent', () => {
    expect(resolveClientTracker({ 'x-bff-key': KEY }, '10.0.0.1', KEY)).toBe('10.0.0.1');
  });
});

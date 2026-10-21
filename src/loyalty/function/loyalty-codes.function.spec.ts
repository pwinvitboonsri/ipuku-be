import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, formatCode, memberLabel, normalizeCode, randomCode } from './loyalty-codes.function.js';

describe('loyalty codes', () => {
  it('makes 6-character codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomCode();
      expect(code).toHaveLength(6);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('formats and normalizes typed codes', () => {
    expect(formatCode('7QFK2M')).toBe('7QF-K2M');
    expect(normalizeCode('7qf-k2m')).toBe('7QFK2M');
    expect(normalizeCode(' 7QF K2M ')).toBe('7QFK2M');
  });

  it('rejects input that cannot be a code', () => {
    expect(normalizeCode('7QFK2')).toBeNull();
    expect(normalizeCode('7QFK20')).toBeNull(); // 0 is not in the alphabet
  });

  it('labels members', () => {
    expect(memberLabel(4213)).toBe('IPK-004213');
  });
});

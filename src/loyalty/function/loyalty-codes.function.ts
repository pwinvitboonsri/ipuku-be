import { randomBytes, randomInt } from 'node:crypto';

// No 0/O, 1/I/L: the 6-character codes are read off paper and phones and typed by hand
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

export function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

// URL-safe, unguessable: the claim QR carries this, not the short code
export function randomToken(): string {
  return randomBytes(16).toString('base64url');
}

export function randomSeed(): string {
  return randomBytes(20).toString('hex');
}

// "7QFK2M" -> "7QF-K2M", as printed
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// What a person typed ("7qf k2m", "7QF-K2M") -> "7QFK2M"; null if it can't be a code
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

// 42 -> "IPK-000042"
export function memberLabel(memberNo: number): string {
  return `IPK-${String(memberNo).padStart(6, '0')}`;
}

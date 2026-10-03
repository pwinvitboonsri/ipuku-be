import { describe, expect, it } from 'vitest';
import { keyFromUrl, productImageKey } from './product-image.function.js';

const BASE = 'https://img.example.com';
const ID = '0b9a6f8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('productImageKey', () => {
  it('builds a key from the content type', () => {
    expect(productImageKey('image/webp', 120_000, ID)).toBe(`products/${ID}.webp`);
    expect(productImageKey('image/jpeg', 120_000, ID)).toBe(`products/${ID}.jpg`);
  });

  it('rejects other types and bad sizes', () => {
    expect(() => productImageKey('image/png', 1000, ID)).toThrow('Only WebP or JPEG');
    expect(() => productImageKey('image/svg+xml', 1000, ID)).toThrow();
    expect(() => productImageKey('image/webp', 0, ID)).toThrow('between 1 and');
    expect(() => productImageKey('image/webp', 1_048_577, ID)).toThrow('between 1 and');
    expect(() => productImageKey('image/webp', 10.5, ID)).toThrow();
  });
});

describe('keyFromUrl', () => {
  it('returns the key for our product image URLs', () => {
    expect(keyFromUrl(`${BASE}/products/${ID}.webp`, BASE)).toBe(`products/${ID}.webp`);
  });

  it('ignores anything that is not ours', () => {
    expect(keyFromUrl('https://cdn.other.com/products/a.webp', BASE)).toBeNull();
    expect(keyFromUrl(`${BASE}.evil.com/products/${ID}.webp`, BASE)).toBeNull();
    expect(keyFromUrl(`${BASE}/other/${ID}.webp`, BASE)).toBeNull();
    expect(keyFromUrl(`${BASE}/products/../secret.webp`, BASE)).toBeNull();
    expect(keyFromUrl(`${BASE}/products/${ID}.png`, BASE)).toBeNull();
    expect(keyFromUrl(null, BASE)).toBeNull();
    expect(keyFromUrl(`${BASE}/products/${ID}.webp`, undefined)).toBeNull();
  });
});

import { BadRequestException } from '@nestjs/common';

// Product photos are resized in the browser first (≈800 px WebP), so 1 MB is plenty.
export const MAX_IMAGE_BYTES = 1_048_576;
export const IMAGE_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

const PRODUCT_PREFIX = 'products/';

export function productImageKey(contentType: string, size: number, id: string) {
  const ext = IMAGE_TYPES[contentType as ImageType];
  if (!ext) {
    throw new BadRequestException('Only WebP or JPEG images can be uploaded');
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) {
    throw new BadRequestException(
      `Image must be between 1 and ${MAX_IMAGE_BYTES} bytes`,
    );
  }
  return `${PRODUCT_PREFIX}${id}.${ext}`;
}

// The object key, only for a URL that points at one of our product images.
// Anything else (an old pasted link, another bucket, path tricks) gives null.
export function keyFromUrl(
  url: string | null | undefined,
  publicUrl: string | undefined,
): string | null {
  if (!url || !publicUrl) return null;
  const base = `${publicUrl}/`;
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return /^products\/[A-Za-z0-9-]+\.(webp|jpg)$/.test(key) ? key : null;
}

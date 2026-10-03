import { timingSafeEqual } from 'crypto';

// Every POS request reaches the API through the Next.js backend-for-frontend, so the
// socket IP is the BFF's. The BFF forwards the tablet's IP in x-client-ip and proves
// it is the BFF with x-bff-key; anyone else gets throttled by their own IP.
export function resolveClientTracker(
  headers: Record<string, string | string[] | undefined>,
  socketIp: string,
  bffKey: string | undefined,
): string {
  const key = headers['x-bff-key'];
  const clientIp = headers['x-client-ip'];
  if (!bffKey || typeof key !== 'string' || typeof clientIp !== 'string' || !clientIp) {
    return socketIp;
  }

  const expected = Buffer.from(bffKey);
  const received = Buffer.from(key);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return socketIp;
  }
  return clientIp;
}

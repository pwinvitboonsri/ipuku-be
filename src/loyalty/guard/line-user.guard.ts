import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { LineClient, LineIdentity } from '../../line/line.client.js';

const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 2000;

type LineRequest = Request & { lineUser?: LineIdentity };

// LIFF calls: "Authorization: Bearer <liff.getIDToken()>". LINE verifies the token (signature,
// expiry, audience); a short cache keeps a burst of calls from one screen to one LINE round trip.
// An expired token (1 h) is a 401 and the LIFF app fetches a fresh one.
@Injectable()
export class LineUserGuard implements CanActivate {
  private readonly cache = new Map<string, { user: LineIdentity; until: number }>();

  constructor(private readonly line: LineClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<LineRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || token.length > 4000) throw new UnauthorizedException('LINE ID token required');

    const key = createHash('sha256').update(token).digest('base64url');
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.until > now) {
      req.lineUser = hit.user;
      return true;
    }

    const user = await this.line.verifyIdToken(token);
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    // never past the token's own expiry: LINE would reject it from then on
    this.cache.set(key, { user, until: Math.min(now + CACHE_MS, user.expiresAt) });
    req.lineUser = user;
    return true;
  }
}

export const LineUser = createParamDecorator((_: unknown, ctx: ExecutionContext): LineIdentity => {
  return ctx.switchToHttp().getRequest<LineRequest>().lineUser!;
});

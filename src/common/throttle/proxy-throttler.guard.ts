import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveClientTracker } from './function/client-tracker.function.js';

// Rate limits per tablet, not per BFF server (see resolveClientTracker)
@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientTracker(req.headers ?? {}, req.ip, process.env.BFF_KEY);
  }
}

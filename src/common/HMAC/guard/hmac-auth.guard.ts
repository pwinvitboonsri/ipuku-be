import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000;

@Injectable()
export class HmacAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !timestamp)
      throw new UnauthorizedException('Missing signature headers');

    const timestampMs = Number(timestamp);

    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > MAX_CLOCK_DRIFT_MS
    ) {
      throw new UnauthorizedException('Request expired');
    }

    const secret = this.config.get<string>('HMAC_SECRET')!;
    const payload = `${timestamp}.${req.method}.${req.originalUrl}`;

    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}

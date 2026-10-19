import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { verifyLineSignature } from '../function/verify-line-signature.function.js';

// Webhooks from LINE carry x-line-signature over the raw body (rawBody: true in main.ts)
@Injectable()
export class LineSignatureGuard implements CanActivate {
  private readonly logger = new Logger(LineSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const header = req.headers['x-line-signature'];
    const signature = typeof header === 'string' ? header : undefined;
    const secret = this.config.get<string>('line.channelSecret')!;

    if (!verifyLineSignature(req.rawBody, signature, secret)) {
      // says which part failed, never the secret itself
      const reason = !signature
        ? 'no x-line-signature header'
        : !req.rawBody
          ? 'raw body missing'
          : `signature mismatch: LINE_CHANNEL_SECRET (${secret.length} chars) is not the Messaging API channel's secret`;
      this.logger.warn(`Webhook rejected: ${reason}`);
      throw new UnauthorizedException('Invalid LINE signature');
    }
    return true;
  }
}

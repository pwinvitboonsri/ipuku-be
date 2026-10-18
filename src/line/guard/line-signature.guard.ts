import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { verifyLineSignature } from '../function/verify-line-signature.function.js';

// Webhooks from LINE carry x-line-signature over the raw body (rawBody: true in main.ts)
@Injectable()
export class LineSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-line-signature'];

    const ok = verifyLineSignature(
      req.rawBody,
      typeof signature === 'string' ? signature : undefined,
      this.config.get<string>('line.channelSecret')!,
    );
    if (!ok) {
      throw new UnauthorizedException('Invalid LINE signature');
    }
    return true;
  }
}

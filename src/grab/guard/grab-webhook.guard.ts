import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// audience of the tokens issued at POST /grab/oauth/token
export const GRAB_TOKEN_AUDIENCE = 'grab-webhook';

// Webhooks from Grab carry the Bearer token we issued at POST /grab/oauth/token.
// Signed with its own secret, so a staff JWT can never call these routes.
@Injectable()
export class GrabWebhookGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('grab.webhookJwtSecret'),
        audience: GRAB_TOKEN_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'crypto';
import { GrabEnabledGuard } from './guard/grab-enabled.guard.js';
import { GRAB_TOKEN_AUDIENCE } from './guard/grab-webhook.guard.js';
import { GrabTokenRequestDTO } from './dto/grab-token-request.dto.js';
import { parseGrabBody } from './function/parse-grab-body.function.js';

const TOKEN_TTL_SECONDS = 3600;

// equal-length digests, so the comparison takes the same time whatever the input
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );

// OAuth2 client-credentials endpoint Grab calls before it calls our webhooks
@UseGuards(GrabEnabledGuard)
@Controller('grab/oauth')
export class GrabAuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() body: Record<string, unknown>) {
    const dto = parseGrabBody(GrabTokenRequestDTO, body);

    const validId = sameSecret(
      dto.client_id,
      this.config.get<string>('grab.partnerClientId')!,
    );
    const validSecret = sameSecret(
      dto.client_secret,
      this.config.get<string>('grab.partnerClientSecret')!,
    );

    if (!validId || !validSecret) {
      throw new UnauthorizedException('invalid_client');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: dto.client_id },
      {
        secret: this.config.get<string>('grab.webhookJwtSecret'),
        audience: GRAB_TOKEN_AUDIENCE,
        expiresIn: TOKEN_TTL_SECONDS,
      },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
    };
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { LineEnabledGuard } from './guard/line-enabled.guard.js';
import { LineClient } from './line.client.js';
import { VerifyIdTokenDTO } from './dto/verify-id-token.dto.js';
import { PushTestDTO } from './dto/push-test.dto.js';

// PoC endpoints for the LINE spike (design's checklist). Replaced by the loyalty routes in Phase 1.
@UseGuards(LineEnabledGuard)
@Controller('line')
export class LineController {
  constructor(private readonly line: LineClient) {}

  // called by the LIFF app: proves the backend can verify a LIFF ID token
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyIdTokenDTO) {
    return await this.line.verifyIdToken(dto.id_token);
  }

  // owner pushes to their own userId, then blocks the OA and pushes again to record the error
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post('push-test')
  @HttpCode(HttpStatus.OK)
  async pushTest(@Body() dto: PushTestDTO) {
    return await this.line.pushText(dto.to, dto.text);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LineEnabledGuard } from '../line/guard/line-enabled.guard.js';
import type { LineIdentity } from '../line/line.client.js';
import { LineUser, LineUserGuard } from './guard/line-user.guard.js';
import { LoyaltyMemberService } from './loyalty-member.service.js';
import { ClaimDTO, JoinDTO } from './dto/member-requests.dto.js';

// Called by the LIFF app in LINE with "Authorization: Bearer <LINE ID token>"
@UseGuards(LineEnabledGuard, LineUserGuard)
@Controller('loyalty/me')
export class LoyaltyMemberController {
  constructor(private readonly members: LoyaltyMemberService) {}

  @Get()
  async me(@LineUser() user: LineIdentity) {
    return { success: true, data: await this.members.me(user) };
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  async join(@LineUser() user: LineIdentity, @Body() dto: JoinDTO) {
    return { success: true, data: await this.members.join(user, dto.consent_version) };
  }

  // typed codes can be guessed: keep tries low
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claim(@LineUser() user: LineIdentity, @Body() dto: ClaimDTO) {
    return { success: true, data: await this.members.claim(user, dto) };
  }

  @Get('rewards')
  async rewards(@LineUser() user: LineIdentity) {
    return { success: true, data: await this.members.rewards(user) };
  }

  @Post('rewards/:id/redeem')
  @HttpCode(HttpStatus.OK)
  async redeem(@LineUser() user: LineIdentity, @Param('id') id: string) {
    return { success: true, data: await this.members.redeem(user, id) };
  }

  @Get('reward-codes/:code')
  async codeStatus(@LineUser() user: LineIdentity, @Param('code') code: string) {
    return { success: true, data: await this.members.codeStatus(user, code) };
  }

  @Post('reward-codes/:code/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@LineUser() user: LineIdentity, @Param('code') code: string) {
    return { success: true, data: await this.members.cancelCode(user, code) };
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
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
    const birthday = dto.birth_day && dto.birth_month ? { day: dto.birth_day, month: dto.birth_month } : undefined;
    return { success: true, data: await this.members.join(user, dto.consent_version, birthday) };
  }

  // typed codes are limited per member in the service (customers on the shop Wi-Fi share one IP)
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

  // a wallet coupon (welcome, birthday…) shown as a reward QR
  @Post('coupons/:id/use')
  @HttpCode(HttpStatus.OK)
  async useCoupon(@LineUser() user: LineIdentity, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.members.useCoupon(user, id) };
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

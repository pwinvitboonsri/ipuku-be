import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { ValidateRewardDTO } from './dto/member-requests.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('loyalty')
export class LoyaltyPosController {
  constructor(private readonly orders: LoyaltyOrderService) {}

  // "Scan reward" at the counter. Nothing is locked until the order is created with the code.
  @Post('reward-codes/validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateRewardDTO) {
    return { success: true, data: await this.orders.validate(dto.input) };
  }
}

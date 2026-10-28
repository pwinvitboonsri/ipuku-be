import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
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

  // Checks a code without holding it
  @Post('reward-codes/validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body() dto: ValidateRewardDTO) {
    return { success: true, data: await this.orders.validate(dto.input) };
  }

  // "Scan reward" at the counter: holds the code for this order-to-be (scan first, items after)
  @Post('reward-codes/reserve')
  @HttpCode(HttpStatus.OK)
  async reserve(@Body() dto: ValidateRewardDTO) {
    return { success: true, data: await this.orders.reserve(dto.input) };
  }

  // Reward taken off the cart: back to the customer's LINE
  @Post('reward-codes/:code/release')
  @HttpCode(HttpStatus.OK)
  async release(@Param('code') code: string) {
    return { success: true, data: await this.orders.release(code) };
  }
}

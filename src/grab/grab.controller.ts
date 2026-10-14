import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { GrabEnabledGuard } from './guard/grab-enabled.guard.js';
import { GrabOrderService } from './grab-order.service.js';

// Grab actions taken by staff on the POS (staff JWT, not Grab's token)
@UseGuards(JwtAuthGuard, RolesGuard, GrabEnabledGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('grab')
export class GrabController {
  constructor(private readonly grabOrderService: GrabOrderService) {}

  // "Got it": someone saw the order, stop the re-alerts
  @Post('orders/:orderId/ack')
  @HttpCode(HttpStatus.OK)
  async acknowledge(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: any,
  ) {
    const result = await this.grabOrderService.acknowledge(
      orderId,
      req.user.userId,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return { success: true, data: result };
  }

  // after editing the menu: ask Grab to pull it again
  @Roles(Role.OWNER)
  @Post('menu/notify')
  @HttpCode(HttpStatus.OK)
  async notifyMenu() {
    await this.grabOrderService.notifyMenuUpdate();
    return { success: true };
  }
}

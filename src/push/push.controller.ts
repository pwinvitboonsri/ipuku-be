import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { PushService } from './push.service.js';
import { SubscribeDTO, UnsubscribeDTO } from './dto/subscribe.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // null = push is not configured on the server
  @Get('public-key')
  publicKey() {
    return { success: true, data: { public_key: this.pushService.publicKey } };
  }

  @Post('subscribe')
  async subscribe(@Body() dto: SubscribeDTO, @Req() req: any) {
    if (!this.pushService.publicKey) {
      throw new ServiceUnavailableException('Push is not configured');
    }
    await this.pushService.subscribe(
      dto,
      req.user.userId,
      req.headers['user-agent'],
    );
    return { success: true };
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDTO) {
    await this.pushService.unsubscribe(dto.endpoint);
    return { success: true };
  }

  @Roles(Role.OWNER)
  @Post('test')
  async test() {
    if (!this.pushService.publicKey) {
      throw new ServiceUnavailableException('Push is not configured');
    }
    const result = await this.pushService.sendToAll({
      title: 'Ippuku test alert',
      body: 'Grab alerts work on this device.',
      tag: 'test',
      url: '/sell',
    });
    return { success: true, data: result };
  }
}

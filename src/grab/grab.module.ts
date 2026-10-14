import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { OrderModule } from '../order/order.module.js';
import { MenuModule } from '../menu/menu.module.js';
import { PushModule } from '../push/push.module.js';
import { GrabAuthController } from './grab-auth.controller.js';
import { GrabWebhookController } from './grab-webhook.controller.js';
import { GrabController } from './grab.controller.js';
import { GrabOrderService } from './grab-order.service.js';
import { GrabMenuService } from './grab-menu.service.js';
import { GrabClient } from './grab.client.js';
import { GrabEnabledGuard } from './guard/grab-enabled.guard.js';
import { GrabWebhookGuard } from './guard/grab-webhook.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // no default secret: Grab tokens are signed/verified with GRAB_WEBHOOK_JWT_SECRET per call
    JwtModule.register({}),
    CommonModule,
    OrderModule,
    MenuModule,
    PushModule,
  ],
  controllers: [GrabAuthController, GrabWebhookController, GrabController],
  providers: [
    GrabOrderService,
    GrabMenuService,
    GrabClient,
    GrabEnabledGuard,
    GrabWebhookGuard,
  ],
})
export class GrabModule {}

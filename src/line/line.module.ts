import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { LineWebhookController } from './line-webhook.controller.js';
import { LineController } from './line.controller.js';
import { LineClient } from './line.client.js';
import { LineEnabledGuard } from './guard/line-enabled.guard.js';
import { LineSignatureGuard } from './guard/line-signature.guard.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [LineWebhookController, LineController],
  providers: [LineClient, LineEnabledGuard, LineSignatureGuard],
  exports: [LineClient],
})
export class LineModule {}

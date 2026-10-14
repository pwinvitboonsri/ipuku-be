import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PushService } from './push.service.js';
import { PushController } from './push.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [PushController],
  providers: [PushService],
  // used by the grab module to alert devices about new orders
  exports: [PushService],
})
export class PushModule {}

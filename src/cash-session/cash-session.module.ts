import { Module } from '@nestjs/common';
import { CashSessionService } from './cash-session.service.js';
import { CashSessionController } from './cash-session.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [CashSessionController],
  providers: [CashSessionService],
})
export class CashSessionModule {}

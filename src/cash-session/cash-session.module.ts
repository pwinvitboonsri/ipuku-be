import { Module } from '@nestjs/common';
import { CashSessionService } from './cash-session.service.js';
import { CashSessionController } from './cash-session.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { ShopHoursModule } from '../shop-hours/shop-hours.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule, ShopHoursModule],
  controllers: [CashSessionController],
  providers: [CashSessionService],
})
export class CashSessionModule {}

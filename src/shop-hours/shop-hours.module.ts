import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { ShopHoursController } from './shop-hours.controller.js';
import { ShopHoursService } from './shop-hours.service.js';
import { ShiftAutoService } from './shift-auto.service.js';

// Opening hours and the shifts that follow them. Cash sessions and orders call ShiftAutoService.
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), LoyaltyModule],
  controllers: [ShopHoursController],
  providers: [ShopHoursService, ShiftAutoService],
  exports: [ShiftAutoService],
})
export class ShopHoursModule {}

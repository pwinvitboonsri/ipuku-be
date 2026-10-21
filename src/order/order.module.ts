import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { PaymentService } from './payment.service.js';
import { StockMovementModule } from '../stock-movement/stock-movement.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule,
    StockMovementModule,
    LoyaltyModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, PaymentService],
  // the grab module creates and pays Grab orders through the same path
  exports: [OrderService, PaymentService],
})
export class OrderModule {}

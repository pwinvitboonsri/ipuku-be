import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { PaymentService } from './payment.service.js';
import { StockMovementModule } from '../stock-movement/stock-movement.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CommonModule,
    StockMovementModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, PaymentService],
})
export class OrderModule {}

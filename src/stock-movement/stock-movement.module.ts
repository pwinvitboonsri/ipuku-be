import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { StockMovementService } from './stock-movement.service.js';
import { StockMovementController } from './stock-movement.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule],
  controllers: [StockMovementController],
  providers: [StockMovementService],
  // used by the order module to deduct stock on payment
  exports: [StockMovementService],
})
export class StockMovementModule {}

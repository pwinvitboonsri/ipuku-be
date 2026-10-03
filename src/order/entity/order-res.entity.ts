import { OrderEntity } from './order.entity.js';
import type { StockAlert } from '../../stock-movement/function/stock-alerts.function.js';

export class OrderResEntity {
  success: boolean;
  data: OrderEntity;
  // pay only: ingredients this sale just took to/below reorder level or out of stock
  meta?: {
    stock_alerts: StockAlert[];
  };

  constructor(partial: Partial<OrderResEntity>) {
    Object.assign(this, partial);
  }
}

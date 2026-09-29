import { OrderEntity } from './order.entity.js';

export class OrderResEntity {
  success: boolean;
  data: OrderEntity;

  constructor(partial: Partial<OrderResEntity>) {
    Object.assign(this, partial);
  }
}

import { OrderEntity } from './order.entity.js';

export class OrderListEntity {
  success: boolean;
  data: OrderEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<OrderListEntity>) {
    Object.assign(this, partial);
  }
}

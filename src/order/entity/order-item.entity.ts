import { OrderItemModifierEntity } from './order-item-modifier.entity.js';

export class OrderItemEntity {
  id: string;
  quantity: number;
  unit_price_satang: number;
  line_total_satang: number;
  product_name_snapshot: string;
  order_id: string;
  product_id: string;
  update_at: Date;
  create_at: Date;
  order_item_modifier?: OrderItemModifierEntity[];

  constructor(partial: Partial<OrderItemEntity>) {
    Object.assign(this, partial);
  }
}

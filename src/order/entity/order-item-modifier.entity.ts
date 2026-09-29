export class OrderItemModifierEntity {
  id: string;
  price_delta_satang: number;
  name_snapshot: string;
  order_item_id: string;
  modifier_option_id: string;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<OrderItemModifierEntity>) {
    Object.assign(this, partial);
  }
}

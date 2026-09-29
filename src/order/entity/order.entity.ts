import { PaymentType, Status } from '../../generated/prisma/enums.js';
import { OrderItemEntity } from './order-item.entity.js';

export class OrderEntity {
  id: string;
  order_number: number;
  status: Status;
  subtotal_satang: number;
  discount_satang: number;
  total_satang: number;
  client_order_id: string;
  paid_at: Date | null;
  cash_session_id: string;
  staff_id: string;
  update_at: Date;
  create_at: Date;
  order_item?: OrderItemEntity[];
  payment?: {
    id: string;
    method: PaymentType;
    amount_satang: number;
    tender_satang: number | null;
    change_satang: number | null;
    reference: string | null;
    marked_by_staff_id: string;
    order_id: string;
    update_at: Date;
    create_at: Date;
  }[];

  constructor(partial: Partial<OrderEntity>) {
    Object.assign(this, partial);
  }
}

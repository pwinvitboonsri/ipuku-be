import { BadRequestException } from '@nestjs/common';
import { CreateOrderItemDTO } from '../../order/dto/create-order-item.dto.js';
import { GrabSubmitOrderDTO } from '../dto/grab-submit-order.dto.js';

// Grab order -> our order items. The menu we serve Grab uses our own ids
// (product.id / modifier_option.id), so items map back without a lookup table.
// Validation and pricing happen afterwards in buildOrderItem, same as the counter.
export function mapGrabOrder(payload: GrabSubmitOrderDTO): CreateOrderItemDTO[] {
  return payload.items.map((item) => {
    const modifiers = item.modifiers ?? [];

    // our order lines hold each option once
    const repeated = modifiers.find((m) => m.quantity !== 1);
    if (repeated) {
      throw new BadRequestException(
        `Modifier ${repeated.id} with quantity ${repeated.quantity} is not supported`,
      );
    }

    return {
      product_id: item.id,
      quantity: item.quantity,
      modifier_option_ids: [...new Set(modifiers.map((m) => m.id))],
    };
  });
}

// "2× Iced latte, 1× Green tea" for the push alert
export function summarizeItems(
  items: { product_name_snapshot: string; quantity: number }[],
): string {
  return items
    .map((i) => `${i.quantity}× ${i.product_name_snapshot}`)
    .join(', ');
}

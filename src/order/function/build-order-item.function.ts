import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { ModifierOptionModel } from '../../generated/prisma/models/ModifierOption.js';
import { CreateOrderItemDTO } from '../dto/create-order-item.dto.js';

// Active product with its attached active modifier groups
export const productWithGroupsInclude = {
  modifier_group: {
    where: { modifier_group: { is_active: true } },
    include: { modifier_group: true },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithGroups = Prisma.ProductGetPayload<{
  include: typeof productWithGroupsInclude;
}>;

// Validates one requested item and prices it from the database, never from the client.
export function buildOrderItem(
  item: CreateOrderItemDTO,
  product: ProductWithGroups | undefined,
  optionsById: Map<string, ModifierOptionModel>,
) {
  if (!product) {
    throw new NotFoundException(`Product ${item.product_id} not found`);
  }

  const groupsById = new Map(
    product.modifier_group.map((pmg) => [
      pmg.modifier_group.id,
      pmg.modifier_group,
    ]),
  );

  const selectedOptions: ModifierOptionModel[] = [];
  const countByGroup = new Map<string, number>();

  for (const optionId of item.modifier_option_ids) {
    const option = optionsById.get(optionId);

    if (!option || !option.is_active) {
      throw new BadRequestException(
        `Modifier option ${optionId} is not available`,
      );
    }

    if (!groupsById.has(option.group_id)) {
      throw new BadRequestException(
        `Option "${option.name}" is not available for "${product.name}"`,
      );
    }

    selectedOptions.push(option);
    countByGroup.set(
      option.group_id,
      (countByGroup.get(option.group_id) ?? 0) + 1,
    );
  }

  for (const group of groupsById.values()) {
    const count = countByGroup.get(group.id) ?? 0;

    if (count < group.min_select || count > group.max_select) {
      const rule =
        group.min_select === group.max_select
          ? `exactly ${group.min_select}`
          : `${group.min_select}-${group.max_select}`;

      throw new BadRequestException(
        `"${group.name}" on "${product.name}" needs ${rule} selection(s), got ${count}`,
      );
    }
  }

  const unitPriceSatang =
    product.price_satang +
    selectedOptions.reduce((sum, option) => sum + option.price_delta_satang, 0);

  const lineTotalSatang = unitPriceSatang * item.quantity;

  const data = {
    product_id: product.id,
    quantity: item.quantity,
    unit_price_satang: unitPriceSatang,
    line_total_satang: lineTotalSatang,
    product_name_snapshot: product.name,
    order_item_modifier: {
      create: selectedOptions.map((option) => ({
        modifier_option_id: option.id,
        name_snapshot: option.name,
        price_delta_satang: option.price_delta_satang,
      })),
    },
  } satisfies Prisma.OrderItemUncheckedCreateWithoutOrderInput;

  return data;
}

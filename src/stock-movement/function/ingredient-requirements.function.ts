import { Prisma } from '../../generated/prisma/client.js';

// What one order needs from stock. This is the single source of truth for
// "which ingredients, how much" — stock deduction (and any future pre-pay
// check) must go through loadIngredientRequirements so they can never differ.

export type RequirementItem = {
  product_id: string;
  quantity: number;
  // options actually sold on this line (OrderItemModifier snapshot)
  modifier_option_ids: string[];
};

export type BaseRecipeLine = {
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
};

export type ModifierRecipeLine = {
  product_id: string;
  modifier_option_id: string;
  ingredient_id: string;
  quantity_delta: number;
};

// Per item: base recipe + deltas of the selected options *for that product*,
// summed per ingredient and clamped at 0 (an item can't put stock back),
// times quantity. Then summed across every item in the order.
// Quantities are hundredths of the ingredient unit. Zero totals are dropped.
export function computeIngredientRequirements(
  items: RequirementItem[],
  base: BaseRecipeLine[],
  mods: ModifierRecipeLine[],
): Map<string, number> {
  const total = new Map<string, number>();

  for (const item of items) {
    const perUnit = new Map<string, number>();
    const add = (ingredientId: string, qty: number) =>
      perUnit.set(ingredientId, (perUnit.get(ingredientId) ?? 0) + qty);

    for (const line of base) {
      if (line.product_id === item.product_id) {
        add(line.ingredient_id, line.quantity_per_unit);
      }
    }

    const selected = new Set(item.modifier_option_ids);
    for (const line of mods) {
      if (
        line.product_id === item.product_id &&
        selected.has(line.modifier_option_id)
      ) {
        add(line.ingredient_id, line.quantity_delta);
      }
    }

    for (const [ingredientId, qty] of perUnit) {
      const used = Math.max(0, qty) * item.quantity;
      if (used > 0) {
        total.set(ingredientId, (total.get(ingredientId) ?? 0) + used);
      }
    }
  }

  return total;
}

// Loads every recipe row the order can touch in two queries (not one per
// option), then computes the requirements.
export async function loadIngredientRequirements(
  tx: Prisma.TransactionClient,
  items: RequirementItem[],
): Promise<Map<string, number>> {
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const optionIds = [...new Set(items.flatMap((i) => i.modifier_option_ids))];

  if (productIds.length === 0) return new Map();

  const [base, mods] = await Promise.all([
    tx.recipe.findMany({
      where: { product_id: { in: productIds } },
      select: { product_id: true, ingredient_id: true, quantity_per_unit: true },
    }),
    optionIds.length === 0
      ? Promise.resolve([])
      : tx.recipeModifier.findMany({
          where: {
            product_id: { in: productIds },
            modifier_option_id: { in: optionIds },
          },
          select: {
            product_id: true,
            modifier_option_id: true,
            ingredient_id: true,
            quantity_delta: true,
          },
        }),
  ]);

  return computeIngredientRequirements(items, base, mods);
}

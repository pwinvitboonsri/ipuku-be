// Stock status of a product from its base recipe, for the counter grid.
// OUT: some ingredient can't cover one more unit. LOW: some ingredient is at or
// below its reorder level. Warn-only: the counter still sells it.
// Option-specific ingredients (e.g. oat milk) aren't in the base recipe, so they
// only show up in the after-sale alerts.

export type StockStatus = 'OK' | 'LOW' | 'OUT';

export type RecipeStockLine = {
  quantity_per_unit: number;
  ingredient: {
    id: string;
    name: string;
    stock_quantity: number;
    reorder_level: number;
    is_active: boolean;
  };
};

export type ProductStock = {
  status: StockStatus;
  // only the ingredients that are LOW or OUT, worst first
  ingredients: {
    id: string;
    name: string;
    status: Exclude<StockStatus, 'OK'>;
  }[];
};

const RANK = { OUT: 0, LOW: 1 } as const;

export function productStock(recipe: RecipeStockLine[]): ProductStock {
  const ingredients: ProductStock['ingredients'] = [];
  for (const { quantity_per_unit, ingredient: i } of recipe) {
    if (!i.is_active) continue;
    if (i.stock_quantity < quantity_per_unit) {
      ingredients.push({ id: i.id, name: i.name, status: 'OUT' });
    } else if (i.stock_quantity <= i.reorder_level) {
      ingredients.push({ id: i.id, name: i.name, status: 'LOW' });
    }
  }
  ingredients.sort(
    (a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name),
  );
  return { status: ingredients[0]?.status ?? 'OK', ingredients };
}

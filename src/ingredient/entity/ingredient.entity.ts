export class IngredientEntity {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<IngredientEntity>) {
    Object.assign(this, partial);
  }
}

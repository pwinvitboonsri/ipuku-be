export class RecipeEntity {
  id: string;
  quantity_per_unit: number;
  product_id: string;
  ingredient_id: string;
  update_at: Date;
  create_at: Date;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
  };

  constructor(partial: Partial<RecipeEntity>) {
    Object.assign(this, partial);
  }
}

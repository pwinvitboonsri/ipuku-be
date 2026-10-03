export class RecipeModifierEntity {
  id: string;
  quantity_delta: number;
  product_id: string;
  modifier_option_id: string;
  ingredient_id: string;
  update_at: Date;
  create_at: Date;
  ingredient?: {
    id: string;
    name: string;
    unit: string;
  };
  modifier_option?: {
    id: string;
    name: string;
    group_id: string;
  };

  constructor(partial: Partial<RecipeModifierEntity>) {
    Object.assign(this, partial);
  }
}

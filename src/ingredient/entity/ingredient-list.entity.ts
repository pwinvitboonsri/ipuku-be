import { IngredientEntity } from './ingredient.entity.js';

export class IngredientListEntity {
  success: boolean;
  data: IngredientEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<IngredientListEntity>) {
    Object.assign(this, partial);
  }
}

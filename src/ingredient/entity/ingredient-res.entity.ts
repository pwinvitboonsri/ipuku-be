import { IngredientEntity } from './ingredient.entity.js';

export class IngredientResEntity {
  success: boolean;
  data: IngredientEntity;

  constructor(partial: Partial<IngredientResEntity>) {
    Object.assign(this, partial);
  }
}

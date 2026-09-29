import { RecipeEntity } from './recipe.entity.js';

export class RecipeResEntity {
  success: boolean;
  data: RecipeEntity;

  constructor(partial: Partial<RecipeResEntity>) {
    Object.assign(this, partial);
  }
}

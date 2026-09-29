import { RecipeEntity } from './recipe.entity.js';

export class RecipeListEntity {
  success: boolean;
  data: RecipeEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<RecipeListEntity>) {
    Object.assign(this, partial);
  }
}

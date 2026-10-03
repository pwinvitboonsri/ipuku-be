import { RecipeEntity } from './recipe.entity.js';
import { RecipeModifierEntity } from './recipe-modifier.entity.js';

export class RecipeListEntity {
  success: boolean;
  data: RecipeEntity[];
  // product x option lines: what each selected option adds to / takes from the base
  modifiers: RecipeModifierEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<RecipeListEntity>) {
    Object.assign(this, partial);
  }
}

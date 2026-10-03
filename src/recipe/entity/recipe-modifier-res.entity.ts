import { RecipeModifierEntity } from './recipe-modifier.entity.js';

export class RecipeModifierResEntity {
  success: boolean;
  data: RecipeModifierEntity;

  constructor(partial: Partial<RecipeModifierResEntity>) {
    Object.assign(this, partial);
  }
}

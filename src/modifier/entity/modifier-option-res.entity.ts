import { ModifierOptionEntity } from './modifier-option.entity.js';

export class ModifierOptionResEntity {
  success: boolean;
  data: ModifierOptionEntity;

  constructor(partial: Partial<ModifierOptionResEntity>) {
    Object.assign(this, partial);
  }
}

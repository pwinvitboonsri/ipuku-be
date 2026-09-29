import { ModifierGroupEntity } from './modifier-group.entity.js';

export class ModifierGroupResEntity {
  success: boolean;
  data: ModifierGroupEntity;

  constructor(partial: Partial<ModifierGroupResEntity>) {
    Object.assign(this, partial);
  }
}

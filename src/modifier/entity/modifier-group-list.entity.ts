import { ModifierGroupEntity } from './modifier-group.entity.js';

export class ModifierGroupListEntity {
  success: boolean;
  data: ModifierGroupEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<ModifierGroupListEntity>) {
    Object.assign(this, partial);
  }
}

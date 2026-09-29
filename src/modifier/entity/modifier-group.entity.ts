import { ModifierOptionEntity } from './modifier-option.entity.js';

export class ModifierGroupEntity {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  is_active: boolean;
  update_at: Date;
  create_at: Date;
  modifier_option?: ModifierOptionEntity[];

  constructor(partial: Partial<ModifierGroupEntity>) {
    Object.assign(this, partial);
  }
}

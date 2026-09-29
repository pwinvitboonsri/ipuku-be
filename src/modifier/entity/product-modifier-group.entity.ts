import { ModifierGroupEntity } from './modifier-group.entity.js';

export class ProductModifierGroupEntity {
  product_id: string;
  modifier_group_id: string;
  sort_order: number;
  update_at: Date;
  create_at: Date;
  modifier_group?: ModifierGroupEntity;

  constructor(partial: Partial<ProductModifierGroupEntity>) {
    Object.assign(this, partial);
  }
}

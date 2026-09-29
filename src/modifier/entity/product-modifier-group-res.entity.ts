import { ProductModifierGroupEntity } from './product-modifier-group.entity.js';

export class ProductModifierGroupResEntity {
  success: boolean;
  data: ProductModifierGroupEntity;

  constructor(partial: Partial<ProductModifierGroupResEntity>) {
    Object.assign(this, partial);
  }
}

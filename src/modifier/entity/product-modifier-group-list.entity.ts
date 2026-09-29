import { ProductModifierGroupEntity } from './product-modifier-group.entity.js';

export class ProductModifierGroupListEntity {
  success: boolean;
  data: ProductModifierGroupEntity[];
  meta: {
    total: number;
  };

  constructor(partial: Partial<ProductModifierGroupListEntity>) {
    Object.assign(this, partial);
  }
}

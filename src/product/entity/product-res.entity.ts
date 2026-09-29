import { ProductEntity } from './product.entity.js';

export class ProductResEntity {
  success: boolean;
  data: ProductEntity;

  constructor(partial: Partial<ProductResEntity>) {
    Object.assign(this, partial);
  }
}

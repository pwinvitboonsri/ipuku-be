import { ProductEntity } from "./product.entity.js";

export class ProductResListEntity {
  success: boolean;
  data: ProductEntity[]
  meta: {
    total: number;
  };

  constructor(partial: Partial<ProductResListEntity>) {
    Object.assign(this, partial);
  }
}

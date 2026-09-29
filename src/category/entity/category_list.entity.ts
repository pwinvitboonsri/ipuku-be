import { CategoryEntity } from './category.entity.js';

export class CategoryListEntity {
  success: boolean;
  data?: CategoryEntity[];
  meta: {
    total: number
  };

  constructor(partial: Partial<CategoryListEntity>) {
    Object.assign(this, partial);
  }
}

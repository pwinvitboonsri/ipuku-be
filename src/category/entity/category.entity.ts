export class CategoryEntity {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<CategoryEntity>) {
    Object.assign(this, partial);
  }
}

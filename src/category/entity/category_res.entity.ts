export class CategoryResEntity {
  success: boolean;
  data: {
    id: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    update_at: Date;
    create_at: Date;
  };

  constructor(partial: Partial<CategoryResEntity>) {
    Object.assign(this, partial);
  }
}

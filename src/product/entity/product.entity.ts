export class ProductEntity {
  id: string;
  name: string;
  price_satang: number;
  image_url: string | null
  category_id: string;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<ProductEntity>) {
    Object.assign(this, partial);
  }
}

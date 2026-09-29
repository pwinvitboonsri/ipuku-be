export class ModifierOptionEntity {
  id: string;
  name: string;
  price_delta_satang: number;
  sort_order: number;
  is_active: boolean;
  group_id: string;
  update_at: Date;
  create_at: Date;

  constructor(partial: Partial<ModifierOptionEntity>) {
    Object.assign(this, partial);
  }
}

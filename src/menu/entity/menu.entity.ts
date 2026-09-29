export class MenuOptionEntity {
  id: string;
  name: string;
  price_delta_satang: number;
  sort_order: number;
}

export class MenuProductEntity {
  id: string;
  name: string;
  price_satang: number;
  image_url: string | null;
  modifier_group: {
    sort_order: number;
    modifier_group: {
      id: string;
      name: string;
      min_select: number;
      max_select: number;
      modifier_option: MenuOptionEntity[];
    };
  }[];
}

export class MenuCategoryEntity {
  id: string;
  name: string;
  sort_order: number;
  product: MenuProductEntity[];
}

export class MenuResEntity {
  success: boolean;
  data: MenuCategoryEntity[];
  meta: {
    categories: number;
    products: number;
  };

  constructor(partial: Partial<MenuResEntity>) {
    Object.assign(this, partial);
  }
}

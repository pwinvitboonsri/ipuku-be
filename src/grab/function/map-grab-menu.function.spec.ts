import { describe, expect, it } from 'vitest';
import {
  ALL_DAY_SELLING_TIME_ID,
  mapGrabMenu,
  type MenuCategoryInput,
} from './map-grab-menu.function.js';

const ok = { status: 'OK' as const, ingredients: [] };

const coffee: MenuCategoryInput = {
  id: 'cat-coffee',
  name: 'Coffee',
  sort_order: 1,
  product: [
    {
      id: 'latte',
      name: 'Iced latte',
      price_satang: 6500,
      image_url: 'https://img.example.com/latte.jpg',
      stock: ok,
      modifier_group: [
        {
          sort_order: 0,
          modifier_group: {
            id: 'size',
            name: 'Size',
            min_select: 1,
            max_select: 1,
            modifier_option: [
              { id: 'regular', name: 'Regular', price_delta_satang: 0, sort_order: 0 },
              { id: 'large', name: 'Large', price_delta_satang: 1000, sort_order: 1 },
            ],
          },
        },
      ],
    },
    {
      id: 'mocha',
      name: 'Mocha',
      price_satang: 7000,
      image_url: null,
      stock: { status: 'OUT', ingredients: [{ id: 'choc', name: 'Chocolate', status: 'OUT' }] },
      modifier_group: [],
    },
  ],
};

describe('mapGrabMenu', () => {
  const menu = mapGrabMenu([coffee], 'grab-merchant', 'ipuku');

  it('keeps our ids and satang prices', () => {
    const latte = menu.categories[0].items[0];
    expect(latte).toMatchObject({ id: 'latte', price: 6500, photos: ['https://img.example.com/latte.jpg'] });
    expect(latte.modifierGroups[0]).toMatchObject({
      id: 'size',
      selectionRangeMin: 1,
      selectionRangeMax: 1,
    });
    expect(latte.modifierGroups[0].modifiers.map((m) => [m.id, m.price])).toEqual([
      ['regular', 0],
      ['large', 1000],
    ]);
  });

  it('marks out-of-stock products unavailable', () => {
    expect(menu.categories[0].items[1]).toMatchObject({ id: 'mocha', availableStatus: 'UNAVAILABLE', photos: [] });
  });

  it('puts every category on the all-day selling time', () => {
    expect(menu.sellingTimes.map((s) => s.id)).toEqual([ALL_DAY_SELLING_TIME_ID]);
    expect(menu.categories[0].sellingTimeID).toBe(ALL_DAY_SELLING_TIME_ID);
    expect(menu.currency).toEqual({ code: 'THB', symbol: '฿', exponent: 2 });
  });
});

import type { ProductStock } from '../../menu/function/product-stock.function.js';

// Our sell-screen menu (MenuService.getMenu) -> GrabFood "Get Menu" response.
// Ids are ours, so Grab's order webhook sends product.id / modifier_option.id back.
// Shape follows Grab's partner docs. ⚠ Check against developer.grab.com before going live.

export type MenuCategoryInput = {
  id: string;
  name: string;
  sort_order: number;
  product: {
    id: string;
    name: string;
    price_satang: number;
    image_url: string | null;
    stock: ProductStock;
    modifier_group: {
      sort_order: number;
      modifier_group: {
        id: string;
        name: string;
        min_select: number;
        max_select: number;
        modifier_option: {
          id: string;
          name: string;
          price_delta_satang: number;
          sort_order: number;
        }[];
      };
    }[];
  }[];
};

type Status = 'AVAILABLE' | 'UNAVAILABLE';

// One selling time for the whole menu: Grab's own store hours decide when the shop
// is open, so ours is simply "all day, every day".
export const ALL_DAY_SELLING_TIME_ID = 'ipuku-all-day';
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function mapGrabMenu(
  categories: MenuCategoryInput[],
  merchantId: string,
  partnerMerchantId: string,
) {
  return {
    merchantID: merchantId,
    partnerMerchantID: partnerMerchantId,
    currency: { code: 'THB', symbol: '฿', exponent: 2 },
    sellingTimes: [
      {
        id: ALL_DAY_SELLING_TIME_ID,
        name: 'All day',
        startTime: '2026-01-01 00:00:00',
        endTime: '2099-12-31 23:59:59',
        serviceHours: Object.fromEntries(
          DAYS.map((d) => [
            d,
            {
              openPeriodType: 'OpenPeriod',
              periods: [{ startTime: '00:00', endTime: '23:59' }],
            },
          ]),
        ),
      },
    ],
    categories: categories.map((c, ci) => ({
      id: c.id,
      name: c.name,
      availableStatus: 'AVAILABLE' as Status,
      sellingTimeID: ALL_DAY_SELLING_TIME_ID,
      sequence: ci + 1,
      items: c.product.map((p, pi) => ({
        id: p.id,
        name: p.name,
        // the counter only warns on OUT; Grab can't be told "maybe", so hide it there
        availableStatus: (p.stock.status === 'OUT'
          ? 'UNAVAILABLE'
          : 'AVAILABLE') as Status,
        price: p.price_satang,
        description: '',
        photos: p.image_url ? [p.image_url] : [],
        sequence: pi + 1,
        modifierGroups: p.modifier_group.map(({ modifier_group: g }, gi) => ({
          id: g.id,
          name: g.name,
          availableStatus: 'AVAILABLE' as Status,
          selectionRangeMin: g.min_select,
          selectionRangeMax: g.max_select,
          sequence: gi + 1,
          modifiers: g.modifier_option.map((o, oi) => ({
            id: o.id,
            name: o.name,
            availableStatus: 'AVAILABLE' as Status,
            price: o.price_delta_satang,
            sequence: oi + 1,
          })),
        })),
      })),
    })),
  };
}

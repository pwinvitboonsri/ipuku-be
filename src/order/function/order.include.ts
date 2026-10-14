import { Prisma } from '../../generated/prisma/client.js';

// Order with its items -> modifiers, payments, and the Grab details for GRAB orders
export const orderInclude = {
  order_item: {
    include: { order_item_modifier: true },
    orderBy: { create_at: 'asc' },
  },
  payment: {
    orderBy: { create_at: 'asc' },
  },
  grab_order: {
    select: {
      grab_order_id: true,
      short_order_number: true,
      state: true,
      acknowledged_at: true,
    },
  },
} satisfies Prisma.OrderInclude;

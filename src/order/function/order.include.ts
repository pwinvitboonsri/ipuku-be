import { Prisma } from '../../generated/prisma/client.js';

// Order with its items -> modifiers, and payments
export const orderInclude = {
  order_item: {
    include: { order_item_modifier: true },
    orderBy: { create_at: 'asc' },
  },
  payment: {
    orderBy: { create_at: 'asc' },
  },
} satisfies Prisma.OrderInclude;

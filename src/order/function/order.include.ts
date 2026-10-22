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
  // loyalty: the receipt QR for this order, and the reward that discounted it
  claim_token: {
    select: {
      token: true,
      code: true,
      points: true,
      stamps: true,
      expires_at: true,
      claimed_at: true,
      member: { select: { member_no: true, display_name: true } },
    },
  },
  reward_code: {
    select: {
      code: true,
      status: true,
      reward_name: true,
      cost_points: true,
      discount_satang: true,
      member: { select: { member_no: true, display_name: true } },
    },
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

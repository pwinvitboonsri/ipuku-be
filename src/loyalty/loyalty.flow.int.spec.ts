import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { StockMovementService } from '../stock-movement/stock-movement.service.js';
import { OrderService } from '../order/order.service.js';
import { PaymentService } from '../order/payment.service.js';
import type { LineClient, LineIdentity } from '../line/line.client.js';
import { PaymentType, RewardType, Role } from '../generated/prisma/enums.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { LoyaltyMemberService } from './loyalty-member.service.js';
import { LoyaltyAdminService } from './loyalty-admin.service.js';
import { rewardQrPayload, rewardToken, rewardWindow } from './function/reward-qr.function.js';

// The whole loyalty design against a real Postgres: join → earn → redeem → refund.
// Runs only with LOYALTY_TEST_DATABASE_URL set to a THROWAWAY database (it truncates tables).
const url = process.env.LOYALTY_TEST_DATABASE_URL;

describe.skipIf(!url)('loyalty flow (database)', () => {
  const settings: Record<string, unknown> = {
    'database.url': url,
    'line.enabled': true,
    'line.liffId': '2000000000-TestLiff',
  };
  const config = { get: (k: string) => settings[k] } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const pushes: { to: string; messages: object[] }[] = [];
  const line = {
    push: vi.fn(async (to: string, messages: object[]) => {
      pushes.push({ to, messages });
      return { ok: true, status: 200, body: {} };
    }),
  } as unknown as LineClient;

  const audit = new AuditService(prisma);
  const ledger = new LoyaltyLedgerService(prisma);
  const program = new LoyaltyProgramService(prisma);
  const loyaltyOrders = new LoyaltyOrderService(prisma, config, line, ledger, program);
  const members = new LoyaltyMemberService(prisma, line, ledger, program, loyaltyOrders);
  const admin = new LoyaltyAdminService(prisma, audit, program, loyaltyOrders);
  const orders = new OrderService(prisma, audit, loyaltyOrders);
  const payments = new PaymentService(prisma, audit, new StockMovementService(prisma, audit), loyaltyOrders);

  const ploy: LineIdentity = { userId: 'U-ploy', name: 'Ploy S.', picture: null };
  let staffId = '';
  let latteId = '';
  let croissantId = '';

  const newOrder = (items: string[], reward_code?: string) =>
    orders.create(
      { client_order_id: crypto.randomUUID(), items: items.map((product_id) => ({ product_id, quantity: 1, modifier_option_ids: [] })), reward_code },
      staffId,
      '127.0.0.1',
      'test',
    );
  const payCash = (id: string, amount: number) =>
    payments.pay({ payments: [{ method: PaymentType.CASH, amount_satang: amount, tender_satang: amount }] }, id, staffId, '127.0.0.1', 'test');

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "PointsEntry","RewardCode","ClaimToken","Reward","Member","LoyaltyProgram","LineContact","Payment","OrderItemModifier","OrderItem","Order","CashSession","AuditLog","Product","Category","Staff" CASCADE',
    );
    const staff = await prisma.staff.create({ data: { name: 'Nok', pin_hash: 'x', role: Role.OWNER } });
    staffId = staff.id;
    const cat = await prisma.category.create({ data: { name: 'Drinks', sort_order: 1 } });
    latteId = (await prisma.product.create({ data: { name: 'Iced Latte', price_satang: 8000, category_id: cat.id } })).id;
    croissantId = (await prisma.product.create({ data: { name: 'Croissant', price_satang: 6500, category_id: cat.id } })).id;
    await prisma.cashSession.create({ data: { opening_float_satang: 0, opened_by_staff_id: staffId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs the whole design', async () => {
    const actor = { staffId };
    const latteReward = await admin.createReward(
      { name: 'Free Iced Latte', cost_points: 10, type: RewardType.FREE_ITEM, product_id: latteId, max_discount_satang: 9500 },
      actor,
    );

    // Flow 1: join with consent
    expect((await members.me(ploy)).member).toBeNull();
    await expect(members.claim(ploy, { code: 'AAAAAA' })).rejects.toMatchObject({ response: { reason: 'NOT_MEMBER' } });
    const { program: p } = await members.me(ploy);
    const joined = await members.join(ploy, p.consent_version);
    expect(joined.member?.label).toMatch(/^IPK-\d{6}$/);

    // Flow 2: ฿145 paid → 14 pts QR → claimed once
    const o1 = await newOrder([latteId, croissantId]);
    const paid1 = await payCash(o1.id, 14500);
    const claim1 = loyaltyOrders.withClaimUrl(paid1.order).claim_token as unknown as { code: string; points: number; url: string };
    expect(claim1.points).toBe(14);
    expect(claim1.url).toContain('https://liff.line.me/2000000000-TestLiff?claim=');
    const earned = await members.claim(ploy, { code: claim1.code.toLowerCase() });
    expect(earned).toMatchObject({ points: 14, balance: 14, available: 14 });
    await expect(members.claim(ploy, { code: claim1.code })).rejects.toMatchObject({ response: { reason: 'CLAIMED' } });

    // Flow 3: redeem → points held → POS validates the live QR → discount locked on the order
    const code = await members.redeem(ploy, latteReward.id);
    expect(code).toMatchObject({ balance: 14, held: 10, available: 4 });
    const live = rewardQrPayload(code.code, rewardToken(code.seed, rewardWindow(Date.now())));
    expect((await loyaltyOrders.validate(live)).reward_name).toBe('Free Iced Latte');
    await expect(loyaltyOrders.validate(rewardQrPayload(code.code, '999999'))).rejects.toMatchObject({ response: { reason: 'STALE_QR' } });
    await expect(newOrder([croissantId], code.code)).rejects.toMatchObject({ response: { reason: 'ITEM_MISSING' } });

    // void & edit gives the code back to the customer
    const draft = await newOrder([latteId], code.code);
    expect(draft.discount_satang).toBe(8000);
    await orders.void({ reason: 'edit' }, draft.id, staffId, '127.0.0.1', 'test');
    expect((await members.codeStatus(ploy, code.code)).status).toBe('ACTIVE');

    const o2 = await newOrder([latteId, croissantId], code.display_code);
    expect(o2).toMatchObject({ subtotal_satang: 14500, discount_satang: 8000, total_satang: 6500 });
    await expect(loyaltyOrders.validate(code.code)).rejects.toMatchObject({ response: { reason: 'APPLIED' } });
    const paid2 = await payCash(o2.id, 6500);
    expect((await members.codeStatus(ploy, code.code)).status).toBe('USED');
    expect(await ledger.balance((await prisma.member.findFirstOrThrow()).id)).toEqual({ balance: 4, held: 0, available: 4 });
    expect((paid2.order.claim_token as { points: number }).points).toBe(6);

    // Flow 4: refunding the ฿145 order takes its 14 back (balance goes negative: decided)
    await payments.refund({ reason: 'Wrong order' }, o1.id, staffId, '127.0.0.1', 'test');
    const memberId = (await prisma.member.findFirstOrThrow()).id;
    expect((await ledger.balance(memberId)).balance).toBe(-10);
    // refunding the reward order returns the 10 it spent, and its unclaimed QR stops working
    await payments.refund({ reason: 'Duplicate' }, o2.id, staffId, '127.0.0.1', 'test');
    expect((await ledger.balance(memberId)).balance).toBe(0);
    const claim2 = (paid2.order.claim_token as { code: string }).code;
    await expect(members.claim(ploy, { code: claim2 })).rejects.toMatchObject({ response: { reason: 'REFUNDED' } });

    // Flow 5: back office lists
    const list = await admin.listMembers({ q: 'ploy' });
    expect(list.members[0]).toMatchObject({ balance: 0, visits: 1 });
    const activity = await admin.listActivity({});
    expect(activity.map((a) => a.type)).toEqual(['REVERSAL', 'REVERSAL', 'REDEEM', 'EARN']);

    // pushes: receipt on claim, redeemed on pay, two reversals
    await new Promise((r) => setTimeout(r, 300));
    expect(pushes.map((x) => (x.messages[0] as { altText: string }).altText)).toEqual([
      expect.stringContaining('+14 แต้ม'),
      expect.stringContaining('แลกรางวัลสำเร็จ'),
      expect.stringContaining('ปรับยอดแต้ม'),
      expect.stringContaining('ปรับยอดแต้ม'),
    ]);
  });

  it('pays a ฿0 order covered by a reward, and refuses a code once the balance went negative', async () => {
    const member = await prisma.member.findFirstOrThrow();
    const latte = await prisma.reward.findFirstOrThrow({ where: { name: 'Free Iced Latte' } });
    await prisma.pointsEntry.create({ data: { type: 'EARN', points: 20, note: 'test top-up', member_id: member.id } });

    // free latte on an order of just that latte: nothing to collect
    const code = await members.redeem(ploy, latte.id);
    const free = await newOrder([latteId], code.code);
    expect(free.total_satang).toBe(0);
    await payments.pay({ payments: [] }, free.id, staffId, '127.0.0.1', 'test');
    expect((await members.codeStatus(ploy, code.code)).status).toBe('USED');

    // a code on screen, then a refund-like reversal takes the balance below zero
    const held = await members.redeem(ploy, latte.id);
    await prisma.pointsEntry.create({ data: { type: 'REVERSAL', points: -15, note: 'test reversal', member_id: member.id } });
    await expect(loyaltyOrders.validate(held.code)).rejects.toMatchObject({ response: { reason: 'NOT_ENOUGH' } });
    await expect(newOrder([latteId], held.code)).rejects.toMatchObject({ response: { reason: 'NOT_ENOUGH' } });
  });
});

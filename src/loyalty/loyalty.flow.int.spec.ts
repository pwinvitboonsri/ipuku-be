import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { StockMovementService } from '../stock-movement/stock-movement.service.js';
import { OrderService } from '../order/order.service.js';
import { PaymentService } from '../order/payment.service.js';
import type { LineClient, LineIdentity } from '../line/line.client.js';
import { EarnRuleKind, LoyaltyCurrency, PaymentType, PerkKind, RewardType, Role, WelcomeTrigger } from '../generated/prisma/enums.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { LoyaltyMemberService } from './loyalty-member.service.js';
import { LoyaltyAdminService } from './loyalty-admin.service.js';
import { LoyaltyPerksService } from './loyalty-perks.service.js';
import { rewardQrPayload, rewardToken, rewardWindow } from './function/reward-qr.function.js';
import { ShiftAutoService } from '../shop-hours/shift-auto.service.js';

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
  const perks = new LoyaltyPerksService(prisma, line, loyaltyOrders);
  const members = new LoyaltyMemberService(prisma, line, ledger, program, loyaltyOrders, perks);
  const admin = new LoyaltyAdminService(prisma, audit, program, loyaltyOrders, perks);
  const orders = new OrderService(prisma, audit, loyaltyOrders, new ShiftAutoService(prisma, loyaltyOrders));
  const payments = new PaymentService(prisma, audit, new StockMovementService(prisma, audit), loyaltyOrders);

  const ploy: LineIdentity = { userId: 'U-ploy', name: 'Ploy S.', picture: null, expiresAt: Date.now() + 3600_000 };
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
      'TRUNCATE "PointsEntry","RewardCode","MemberCoupon","PerkGrant","LoyaltyPerk","EarnRule","ClaimToken","Reward","Member","LoyaltyProgram","LineContact","Payment","OrderItemModifier","OrderItem","Order","CashSession","AuditLog","ProductModifierGroup","ModifierOption","ModifierGroup","Product","Category","Staff" CASCADE',
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

  it('scan first: the counter holds the reward, and every way out gives it back to the customer', async () => {
    const member = await prisma.member.findFirstOrThrow();
    const latte = await prisma.reward.findFirstOrThrow({ where: { name: 'Free Iced Latte' } });
    await prisma.pointsEntry.create({ data: { type: 'EARN', points: 40, note: 'test top-up', member_id: member.id } });
    const live = (c: { code: string; seed: string }) => rewardQrPayload(c.code, rewardToken(c.seed, rewardWindow(Date.now())));

    // scanned before anything is in the cart: held (points stay held), customer can't cancel it now
    const code = await members.redeem(ploy, latte.id);
    const held = await loyaltyOrders.reserve(live(code));
    expect(held.reward_name).toBe('Free Iced Latte');
    expect((await members.codeStatus(ploy, code.code)).status).toBe('APPLIED');
    expect((await ledger.balance(member.id)).held).toBe(10);
    await expect(members.cancelCode(ploy, code.code)).rejects.toMatchObject({ response: { reason: 'APPLIED' } });
    // re-scanning at the same counter is fine
    await expect(loyaltyOrders.reserve(code.code)).resolves.toMatchObject({ code: code.code });

    // staff take it off the cart → back on the customer's screen with fresh minutes
    expect(await loyaltyOrders.release(code.code)).toEqual({ released: true });
    const back = await members.codeStatus(ploy, code.code);
    expect(back.status).toBe('ACTIVE');

    // a hold nobody finished (tablet closed) runs out → back to the customer on their next look
    await loyaltyOrders.reserve(code.code);
    await prisma.rewardCode.update({ where: { code: code.code }, data: { reserved_until: new Date(Date.now() - 1000) } });
    expect((await members.rewards(ploy)).active_code?.status).toBe('ACTIVE');

    // scan first, then the latte is added: the order takes the held code; a void gives it back
    await loyaltyOrders.reserve(code.code);
    const order = await newOrder([latteId], code.code);
    expect(order.discount_satang).toBe(8000);
    await orders.void({ reason: 'customer left' }, order.id, staffId, '127.0.0.1', 'test');
    expect((await members.codeStatus(ploy, code.code)).status).toBe('ACTIVE');

    // held, then the customer's code is used on an order and paid
    await loyaltyOrders.reserve(code.code);
    const paidOrder = await newOrder([latteId, croissantId], code.code);
    await payCash(paidOrder.id, paidOrder.total_satang);
    expect((await members.codeStatus(ploy, code.code)).status).toBe('USED');
    await expect(loyaltyOrders.release(code.code)).resolves.toEqual({ released: false });
  });
});

describe.skipIf(!url)('loyalty v2: earn rules, perks, stamps and new reward types (database)', () => {
  const config = { get: (k: string) => ({ 'database.url': url, 'line.enabled': true, 'line.liffId': '2000000000-TestLiff' })[k] } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const pushes: { to: string; messages: { altText?: string }[] }[] = [];
  const line = { push: vi.fn(async (to: string, messages: object[]) => (pushes.push({ to, messages }), { ok: true, status: 200, body: {} })) } as unknown as LineClient;
  const audit = new AuditService(prisma);
  const ledger = new LoyaltyLedgerService(prisma);
  const program = new LoyaltyProgramService(prisma);
  const loyaltyOrders = new LoyaltyOrderService(prisma, config, line, ledger, program);
  const perks = new LoyaltyPerksService(prisma, line, loyaltyOrders);
  const members = new LoyaltyMemberService(prisma, line, ledger, program, loyaltyOrders, perks);
  const admin = new LoyaltyAdminService(prisma, audit, program, loyaltyOrders, perks);
  const orders = new OrderService(prisma, audit, loyaltyOrders, new ShiftAutoService(prisma, loyaltyOrders));
  const payments = new PaymentService(prisma, audit, new StockMovementService(prisma, audit), loyaltyOrders);

  const ploy: LineIdentity = { userId: 'U-ploy2', name: 'Ploy', picture: null, expiresAt: Date.now() + 3600_000 };
  const mint: LineIdentity = { userId: 'U-mint', name: 'Mint', picture: null, expiresAt: Date.now() + 3600_000 };
  const ids = { staff: '', latte: '', americano: '', croissant: '', coffee: '', large: '' };
  const actor = () => ({ staffId: ids.staff });

  const newOrder = (items: { id: string; options?: string[] }[], reward_code?: string) =>
    orders.create(
      { client_order_id: crypto.randomUUID(), items: items.map((i) => ({ product_id: i.id, quantity: 1, modifier_option_ids: i.options ?? [] })), reward_code },
      ids.staff,
      '127.0.0.1',
      'test',
    );
  const pay = (o: { id: string; total_satang: number }) =>
    payments.pay(
      { payments: o.total_satang > 0 ? [{ method: PaymentType.CASH, amount_satang: o.total_satang, tender_satang: o.total_satang }] : [] },
      o.id,
      ids.staff,
      '127.0.0.1',
      'test',
    );
  const memberId = async (u: LineIdentity) => (await prisma.member.findUniqueOrThrow({ where: { line_user_id: u.userId } })).id;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "PointsEntry","RewardCode","MemberCoupon","PerkGrant","LoyaltyPerk","EarnRule","ClaimToken","Reward","Member","LoyaltyProgram","LineContact","Payment","OrderItemModifier","OrderItem","Order","CashSession","AuditLog","ProductModifierGroup","ModifierOption","ModifierGroup","Product","Category","Staff" CASCADE',
    );
    ids.staff = (await prisma.staff.create({ data: { name: 'Nok', pin_hash: 'x', role: Role.OWNER } })).id;
    ids.coffee = (await prisma.category.create({ data: { name: 'Coffee', sort_order: 1 } })).id;
    const bakery = (await prisma.category.create({ data: { name: 'Bakery', sort_order: 2 } })).id;
    ids.latte = (await prisma.product.create({ data: { name: 'Latte', price_satang: 8000, category_id: ids.coffee } })).id;
    ids.americano = (await prisma.product.create({ data: { name: 'Americano', price_satang: 6000, category_id: ids.coffee } })).id;
    ids.croissant = (await prisma.product.create({ data: { name: 'Croissant', price_satang: 6500, category_id: bakery } })).id;
    const size = await prisma.modifierGroup.create({ data: { name: 'Size', min_select: 0, max_select: 1 } });
    ids.large = (await prisma.modifierOption.create({ data: { name: 'Large', price_delta_satang: 1500, group_id: size.id } })).id;
    await prisma.productModifierGroup.create({ data: { product_id: ids.latte, modifier_group_id: size.id } });
    await prisma.cashSession.create({ data: { opening_float_satang: 0, opened_by_staff_id: ids.staff } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('earn rules put points and stamps on the claim QR', async () => {
    await admin.createEarnRule({ name: '2× ทุกวัน', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 20 }, actor());
    await admin.createEarnRule({ name: 'แสตมป์', kind: EarnRuleKind.STAMPS_PER_VISIT, amount: 1, min_spend_satang: 5000 }, actor());
    const { program: p } = await members.me(ploy);
    await members.join(ploy, p.consent_version);

    const paid = await pay(await newOrder([{ id: ids.latte }, { id: ids.croissant }]));
    const claim = await prisma.claimToken.findUniqueOrThrow({ where: { order_id: paid.order.id } });
    expect(claim).toMatchObject({ points: 28, stamps: 1 });
    const result = await members.claim(ploy, { code: claim.code });
    expect(result).toMatchObject({ points: 28, stamps: 1, balance: 28, stamp_balance: { balance: 1 } });
    expect(result.lines.map((l) => l.label)).toEqual(['สะสมจากยอดซื้อ', 'แสตมป์', '2× ทุกวัน']);
  });

  it('welcome coupon on join is used at the counter for free, and comes back on refund', async () => {
    const twenty = await admin.createReward({ name: 'ส่วนลด 20 บาท', cost_points: 10, type: RewardType.FIXED_DISCOUNT, discount_satang: 2000 }, actor());
    await admin.updatePerk(PerkKind.WELCOME, { is_active: true, trigger: WelcomeTrigger.JOIN, reward_id: twenty.id, coupon_valid_days: 30 }, actor());

    const { program: p } = await members.me(mint);
    const joined = await members.join(mint, p.consent_version);
    expect(joined.welcome?.coupon?.reward_name).toBe('ส่วนลด 20 บาท');
    const { coupons } = await members.rewards(mint);
    expect(coupons).toHaveLength(1);

    const code = await members.useCoupon(mint, coupons[0].id);
    expect(code).toMatchObject({ cost_points: 0, from_coupon: true });
    const order = await newOrder([{ id: ids.latte }], code.code);
    expect(order.discount_satang).toBe(2000);
    await pay(order);
    expect((await members.rewards(mint)).coupons).toHaveLength(0);
    expect((await ledger.balance(await memberId(mint))).balance).toBe(0); // a coupon costs nothing

    await payments.refund({ reason: 'test' }, order.id, ids.staff, '127.0.0.1', 'test');
    const back = (await members.rewards(mint)).coupons;
    expect(back).toHaveLength(1);
    expect((await members.useCoupon(mint, back[0].id)).from_coupon).toBe(true);
  });

  it('birthday job grants once a year', async () => {
    await admin.updatePerk(PerkKind.BIRTHDAY, { is_active: true, grant_points: 50 }, actor());
    const today = new Date(Date.now() + 7 * 3600_000);
    await admin.setBirthday(await memberId(ploy), { birth_day: today.getUTCDate(), birth_month: today.getUTCMonth() + 1 }, actor());
    const before = (await ledger.balance(await memberId(ploy))).balance;
    expect(await perks.runBirthdays()).toBe(1);
    expect(await perks.runBirthdays()).toBe(0);
    expect((await ledger.balance(await memberId(ploy))).balance).toBe(before + 50);
    expect(pushes.some((p) => p.messages[0]?.altText?.includes('สุขสันต์วันเกิด'))).toBe(true);
  });

  it('% off, free option and buy-X-get-Y vouchers', async () => {
    await admin.adjustPoints(await memberId(ploy), { currency: LoyaltyCurrency.POINTS, amount: 500, reason: 'test' }, actor());
    const pct = await admin.createReward({ name: '10% off', cost_points: 10, type: RewardType.PERCENT_OFF, percent: 10, max_discount_satang: 3000 }, actor());
    const opt = await admin.createReward({ name: 'Free size-up', cost_points: 10, type: RewardType.FREE_OPTION, option_ids: [ids.large] }, actor());
    const bxgy = await admin.createReward({ name: '2 get 1 coffee', cost_points: 10, type: RewardType.BUY_X_GET_Y, category_ids: [ids.coffee], buy_qty: 2, get_qty: 1, get_percent: 100 }, actor());

    const c1 = await members.redeem(ploy, pct.id);
    expect((await newOrder([{ id: ids.latte }, { id: ids.croissant }], c1.code)).discount_satang).toBe(1450);
    const c2 = await members.redeem(ploy, opt.id);
    expect((await newOrder([{ id: ids.latte, options: [ids.large] }], c2.code)).discount_satang).toBe(1500);
    const c3 = await members.redeem(ploy, bxgy.id);
    await expect(newOrder([{ id: ids.latte }, { id: ids.americano }], c3.code)).rejects.toMatchObject({ response: { reason: 'ITEM_MISSING' } });
    expect((await newOrder([{ id: ids.latte }, { id: ids.americano }, { id: ids.americano }], c3.code)).discount_satang).toBe(6000);
  });

  it('stamp rewards spend stamps; a refund that takes stamps below the hold blocks the code', async () => {
    const stampReward = await admin.createReward({ name: 'Stamp coffee', cost_points: 1, cost_currency: LoyaltyCurrency.STAMPS, type: RewardType.FIXED_DISCOUNT, discount_satang: 1000 }, actor());
    const code = await members.redeem(ploy, stampReward.id);
    expect(code).toMatchObject({ cost_currency: 'STAMPS', available: 0 });

    const first = await prisma.claimToken.findFirstOrThrow({ where: { stamps: 1 }, include: { order: true } });
    await payments.refund({ reason: 'test' }, first.order_id, ids.staff, '127.0.0.1', 'test');
    expect((await ledger.balance(await memberId(ploy), prisma, LoyaltyCurrency.STAMPS)).balance).toBe(0);
    await expect(loyaltyOrders.validate(code.code)).rejects.toMatchObject({ response: { reason: 'NOT_ENOUGH' } });
  });
});


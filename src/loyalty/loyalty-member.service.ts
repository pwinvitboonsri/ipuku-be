import { BadRequestException, ConflictException, ForbiddenException, GoneException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { LoyaltyCurrency, PointsEntryType, RewardCodeStatus, Status, WelcomeTrigger } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineClient, LineIdentity } from '../line/line.client.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { LoyaltyPerksService } from './loyalty-perks.service.js';
import type { EarnLine } from './function/compute-earn.function.js';
import { validBirthday } from './function/birthday.function.js';
import { formatCode, memberLabel, normalizeCode, randomCode, randomSeed } from './function/loyalty-codes.function.js';
import { REWARD_QR_PERIOD_S } from './function/reward-qr.function.js';
import { earnMessage } from './function/line-messages.function.js';

const HISTORY = 30;
const SHOP = 'Ippuku';
// typed receipt codes can be guessed: tries per member per minute (scanned QR tokens can't)
const CODE_TRIES = 10;
const CODE_WINDOW_MS = 60_000;

// What the LIFF app (customer in LINE) can do. Every call carries a verified LINE identity.
@Injectable()
export class LoyaltyMemberService {
  private readonly logger = new Logger(LoyaltyMemberService.name);
  private readonly codeTries = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineClient,
    private readonly ledger: LoyaltyLedgerService,
    private readonly program: LoyaltyProgramService,
    private readonly orders: LoyaltyOrderService,
    private readonly perks: LoyaltyPerksService,
  ) {}

  // A member who accepted the current consent (null otherwise); refreshes name/photo from the LINE profile
  private async findMember(user: LineIdentity, consentVersion: string) {
    const member = await this.prisma.member.findUnique({ where: { line_user_id: user.userId } });
    if (!member || member.consent_version !== consentVersion) return { member: null, found: !!member };
    if (member.display_name !== user.name || member.picture_url !== user.picture) {
      const fresh = await this.prisma.member.update({ where: { id: member.id }, data: { display_name: user.name, picture_url: user.picture } });
      return { member: fresh, found: true };
    }
    return { member, found: true };
  }

  private async member(user: LineIdentity) {
    const program = await this.program.get();
    const { member } = await this.findMember(user, program.consent_version);
    if (!member) throw new ForbiddenException({ message: 'Join the program first', reason: 'NOT_MEMBER' });
    return member;
  }

  private checkCodeTries(memberId: string) {
    const now = Date.now();
    const recent = (this.codeTries.get(memberId) ?? []).filter((t) => now - t < CODE_WINDOW_MS);
    if (recent.length >= CODE_TRIES) {
      throw new HttpException({ message: 'Too many tries — wait a minute', reason: 'TOO_MANY' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.codeTries.set(memberId, recent);
    if (this.codeTries.size > 5000) this.codeTries.delete(this.codeTries.keys().next().value!);
  }

  // My Card: membership state, both balances, next rewards, coupons and recent history
  async me(user: LineIdentity) {
    const program = await this.program.get();
    const { member, found } = await this.findMember(user, program.consent_version);
    const stampReward = await this.prisma.reward.findFirst({
      where: { is_active: true, cost_currency: LoyaltyCurrency.STAMPS, ...this.inWindow(new Date()) },
      orderBy: { cost_points: 'asc' },
    });
    const base = {
      profile: { name: user.name, picture: user.picture },
      program: {
        points_per_unit: program.points_per_unit,
        unit_satang: program.unit_satang,
        consent_version: program.consent_version,
        // size of the stamp card on My Card (the cheapest stamp reward); null = no stamp rewards
        stamp_goal: stampReward?.cost_points ?? null,
      },
    };
    if (!member) {
      // consented to an older version: same member, asked again
      return { ...base, member: null, rejoin: found };
    }

    const balances = await this.ledger.balances(member.id);
    const [history, rewards, coupons] = await Promise.all([
      this.prisma.pointsEntry.findMany({
        where: { member_id: member.id },
        orderBy: { create_at: 'desc' },
        take: HISTORY,
        include: { order: { select: { order_number: true } } },
      }),
      this.prisma.reward.findMany({ where: { is_active: true, ...this.inWindow(new Date()) }, orderBy: [{ cost_points: 'asc' }] }),
      this.prisma.memberCoupon.count({ where: { member_id: member.id, used_at: null, valid_until: { gt: new Date() } } }),
    ]);
    const nextOf = (currency: LoyaltyCurrency, available: number) => {
      const next = rewards.find((r) => r.cost_currency === currency && r.cost_points > available);
      return next ? { name: next.name, cost_points: next.cost_points, need: next.cost_points - available } : null;
    };

    return {
      ...base,
      member: {
        label: memberLabel(member.member_no),
        display_name: member.display_name,
        picture_url: member.picture_url,
        joined_at: member.consented_at,
        birthday: member.birth_day && member.birth_month ? { day: member.birth_day, month: member.birth_month } : null,
        coupons,
        // points at the top level (as before); stamps alongside
        ...balances.points,
        stamps: balances.stamps,
      },
      next_reward: nextOf(LoyaltyCurrency.POINTS, balances.points.available),
      next_stamp_reward: nextOf(LoyaltyCurrency.STAMPS, balances.stamps.available),
      history: history.map((e) => ({
        id: e.id,
        type: e.type,
        currency: e.currency,
        points: e.points,
        note: e.note,
        order_number: e.order?.order_number ?? null,
        create_at: e.create_at,
      })),
    };
  }

  // rewards shown/redeemable now (no dates = always)
  private inWindow(now: Date): Prisma.RewardWhereInput {
    return { AND: [{ OR: [{ starts_at: null }, { starts_at: { lte: now } }] }, { OR: [{ ends_at: null }, { ends_at: { gt: now } }] }] };
  }

  // PDPA consent: creates the member (or records the newer consent version). The birthday is optional
  // and set once here; afterwards only the owner can change it. A JOIN-triggered welcome perk is granted.
  async join(user: LineIdentity, consentVersion: string, birthday?: { day: number; month: number }) {
    const program = await this.program.get();
    if (consentVersion !== program.consent_version) {
      throw new ConflictException({ message: 'Consent text changed — read it again', reason: 'CONSENT_CHANGED' });
    }
    if (birthday && !validBirthday(birthday.day, birthday.month)) {
      throw new BadRequestException({ message: 'Not a real date', reason: 'INVALID_BIRTHDAY' });
    }
    const now = new Date();
    const welcome = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.member.findUnique({ where: { line_user_id: user.userId } });
      const setBirthday = birthday && !(existing?.birth_day && existing.birth_month) ? { birth_day: birthday.day, birth_month: birthday.month } : {};
      const member = await tx.member.upsert({
        where: { line_user_id: user.userId },
        create: { line_user_id: user.userId, display_name: user.name, picture_url: user.picture, consent_version: consentVersion, consented_at: now, ...setBirthday },
        update: { display_name: user.name, picture_url: user.picture, consent_version: consentVersion, consented_at: now, ...setBirthday },
      });
      return await this.perks.welcomeInTx(tx, member.id, WelcomeTrigger.JOIN);
    });
    return { ...(await this.me(user)), welcome };
  }

  // Receipt QR (token from the URL) or the 6-character code typed from the receipt
  async claim(user: LineIdentity, input: { token?: string; code?: string }) {
    const member = await this.member(user);
    const code = input.code ? normalizeCode(input.code) : null;
    if (!input.token && !code) throw new BadRequestException({ message: 'Not a receipt code', reason: 'INVALID' });
    if (!input.token) this.checkCodeTries(member.id);
    const where: Prisma.ClaimTokenWhereUniqueInput = input.token ? { token: input.token } : { code: code! };

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claimToken.findUnique({
        where,
        include: { order: { select: { id: true, order_number: true, status: true, paid_at: true } } },
      });
      if (!claim) throw new NotFoundException({ message: 'Receipt code not found', reason: 'NOT_FOUND' });
      // lock the order so a refund can't land between this check and the EARN row
      // (a refund that wins makes it REFUNDED below; one that waits sees the EARN and reverses it)
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${claim.order.id} FOR UPDATE`;
      const { status } = await tx.order.findUniqueOrThrow({ where: { id: claim.order.id }, select: { status: true } });
      if (claim.claimed_at) {
        throw new ConflictException({ message: 'Already claimed', reason: 'CLAIMED', claimed_at: claim.claimed_at, order_number: claim.order.order_number });
      }
      if (status !== Status.PAID) {
        throw new GoneException({ message: 'This order was refunded', reason: 'REFUNDED', order_number: claim.order.order_number });
      }
      if (claim.expires_at <= new Date()) {
        throw new GoneException({ message: 'QR expired', reason: 'EXPIRED', order_number: claim.order.order_number });
      }

      await this.ledger.lockMember(tx, member.id);
      // only one claim wins, even if two phones scan at once
      const { count } = await tx.claimToken.updateMany({
        where: { id: claim.id, claimed_at: null },
        data: { claimed_at: new Date(), member_id: member.id },
      });
      if (count === 0) throw new ConflictException({ message: 'Already claimed', reason: 'CLAIMED', order_number: claim.order.order_number });

      const firstClaim = (await tx.pointsEntry.count({ where: { member_id: member.id, type: PointsEntryType.EARN } })) === 0;
      for (const [currency, amount] of [
        [LoyaltyCurrency.POINTS, claim.points],
        [LoyaltyCurrency.STAMPS, claim.stamps],
      ] as const) {
        if (amount <= 0) continue;
        await tx.pointsEntry.create({
          data: {
            type: PointsEntryType.EARN,
            currency,
            points: amount,
            note: `Receipt #${claim.order.order_number}`,
            member_id: member.id,
            order_id: claim.order.id,
            claim_token_id: claim.id,
          },
        });
      }
      const welcome = firstClaim ? await this.perks.welcomeInTx(tx, member.id, WelcomeTrigger.FIRST_CLAIM) : null;
      return { claim, welcome, balances: await this.ledger.balances(member.id, tx) };
    });

    void this.pushReceipt(member.line_user_id, result.claim.order.id, result.claim.points, result.claim.stamps, result.balances.points.balance);

    return {
      points: result.claim.points,
      stamps: result.claim.stamps,
      lines: (result.claim.lines as unknown as EarnLine[] | null) ?? [],
      welcome: result.welcome,
      order_number: result.claim.order.order_number,
      total_satang: result.claim.total_satang,
      paid_at: result.claim.order.paid_at,
      ...result.balances.points,
      stamp_balance: result.balances.stamps,
    };
  }

  private async pushReceipt(to: string, orderId: string, points: number, stamps: number, balance: number) {
    try {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { order_item: { orderBy: { create_at: 'asc' } } } });
      await this.line.push(to, [
        earnMessage({
          shop: SHOP,
          orderNumber: order.order_number,
          paidAt: order.paid_at ?? order.create_at,
          lines: order.order_item.map((i) => ({ name: i.product_name_snapshot, qty: i.quantity, totalSatang: i.line_total_satang })),
          discountSatang: order.discount_satang,
          totalSatang: order.total_satang,
          points,
          stamps,
          balance,
          cardUrl: this.orders.liffUrl() ?? '',
        }),
      ]);
    } catch (err) {
      this.logger.warn(`Receipt push failed: ${(err as Error).message}`);
    }
  }

  // Rewards (points or stamps) with what this member can afford, their coupons, and any code on screen now
  async rewards(user: LineIdentity) {
    const member = await this.member(user);
    const now = new Date();
    const balances = await this.ledger.balances(member.id);
    const [rewards, coupons, active] = await Promise.all([
      this.prisma.reward.findMany({
        where: { is_active: true, ...this.inWindow(now) },
        orderBy: [{ sort_order: 'asc' }, { cost_points: 'asc' }],
        include: { product: { select: { name: true, image_url: true } } },
      }),
      this.prisma.memberCoupon.findMany({
        where: { member_id: member.id, used_at: null, valid_until: { gt: now } },
        orderBy: { valid_until: 'asc' },
        include: { reward: { include: { product: { select: { image_url: true } } } } },
      }),
      this.prisma.rewardCode.findFirst({
        where: { member_id: member.id, status: RewardCodeStatus.ACTIVE, expires_at: { gt: now } },
        orderBy: { create_at: 'desc' },
      }),
    ]);
    const available = (c: LoyaltyCurrency) => (c === LoyaltyCurrency.STAMPS ? balances.stamps : balances.points).available;
    return {
      ...balances.points,
      stamps: balances.stamps,
      rewards: rewards.map((r) => ({
        id: r.id,
        name: r.name,
        cost_points: r.cost_points,
        cost_currency: r.cost_currency,
        type: r.type,
        image_url: r.image_url ?? r.product?.image_url ?? null,
        affordable: available(r.cost_currency) >= r.cost_points,
      })),
      coupons: coupons.map((c) => ({
        id: c.id,
        source: c.source,
        reward_name: c.reward.name,
        image_url: c.reward.image_url ?? c.reward.product?.image_url ?? null,
        valid_until: c.valid_until,
      })),
      active_code: active && this.codeView(active),
    };
  }

  private codeView(c: { code: string; seed: string; reward_name: string; cost_points: number; cost_currency: LoyaltyCurrency; coupon_id: string | null; expires_at: Date; status: RewardCodeStatus }) {
    return {
      code: c.code,
      display_code: formatCode(c.code),
      seed: c.seed,
      period_s: REWARD_QR_PERIOD_S,
      reward_name: c.reward_name,
      cost_points: c.cost_points,
      cost_currency: c.cost_currency,
      from_coupon: c.coupon_id !== null,
      expires_at: c.expires_at,
    };
  }

  // a fresh 6-character code not used by any reward code
  private async freeCode(tx: Prisma.TransactionClient) {
    let short = randomCode();
    while (await tx.rewardCode.findUnique({ where: { code: short }, select: { id: true } })) short = randomCode();
    return short;
  }

  // Confirm a reward: issues a code that holds its points/stamps until it's used, cancelled or expires.
  // Showing a new code cancels the member's previous one.
  async redeem(user: LineIdentity, rewardId: string) {
    const member = await this.member(user);
    const program = await this.program.get();

    const code = await this.prisma.$transaction(async (tx) => {
      await this.ledger.lockMember(tx, member.id);
      const reward = await tx.reward.findFirst({ where: { id: rewardId, is_active: true, ...this.inWindow(new Date()) } });
      if (!reward) throw new NotFoundException({ message: 'Reward not available', reason: 'NOT_FOUND' });

      await tx.rewardCode.updateMany({
        where: { member_id: member.id, status: RewardCodeStatus.ACTIVE },
        data: { status: RewardCodeStatus.CANCELLED, cancelled_at: new Date() },
      });
      const { available } = await this.ledger.balance(member.id, tx, reward.cost_currency);
      if (available < reward.cost_points) {
        throw new ConflictException({ message: 'Not enough points', reason: 'NOT_ENOUGH', available, cost_points: reward.cost_points });
      }

      return await tx.rewardCode.create({
        data: {
          code: await this.freeCode(tx),
          seed: randomSeed(),
          reward_name: reward.name,
          cost_points: reward.cost_points,
          cost_currency: reward.cost_currency,
          expires_at: new Date(Date.now() + program.reward_code_minutes * 60 * 1000),
          member_id: member.id,
          reward_id: reward.id,
        },
      });
    });

    return { ...this.codeView(code), ...(await this.ledger.balance(member.id, this.prisma, code.cost_currency)) };
  }

  // Use a wallet coupon: same rotating QR as a bought reward, costs nothing; the coupon is spent when the order is paid
  async useCoupon(user: LineIdentity, couponId: string) {
    const member = await this.member(user);
    const program = await this.program.get();

    const code = await this.prisma.$transaction(async (tx) => {
      await this.ledger.lockMember(tx, member.id);
      const coupon = await tx.memberCoupon.findUnique({ where: { id: couponId }, include: { reward: true, reward_code: true } });
      if (!coupon || coupon.member_id !== member.id || coupon.used_at || coupon.valid_until <= new Date()) {
        throw new NotFoundException({ message: 'Coupon not available', reason: 'NOT_FOUND' });
      }
      if (coupon.reward_code?.status === RewardCodeStatus.APPLIED) {
        throw new ConflictException({ message: 'This coupon is on an order at the counter', reason: 'APPLIED' });
      }
      // cancel whatever the member is showing now, and let an earlier code of this coupon go
      await tx.rewardCode.updateMany({
        where: { member_id: member.id, status: RewardCodeStatus.ACTIVE },
        data: { status: RewardCodeStatus.CANCELLED, cancelled_at: new Date() },
      });
      await tx.rewardCode.updateMany({ where: { coupon_id: coupon.id }, data: { coupon_id: null } });

      const expires = Math.min(Date.now() + program.reward_code_minutes * 60 * 1000, coupon.valid_until.getTime());
      return await tx.rewardCode.create({
        data: {
          code: await this.freeCode(tx),
          seed: randomSeed(),
          reward_name: coupon.reward.name,
          cost_points: 0,
          cost_currency: coupon.reward.cost_currency,
          expires_at: new Date(expires),
          member_id: member.id,
          reward_id: coupon.reward_id,
          coupon_id: coupon.id,
        },
      });
    });

    return { ...this.codeView(code), ...(await this.ledger.balance(member.id)) };
  }

  // LIFF polls this while the QR is on screen: ACTIVE → APPLIED (scanned) → USED (paid)
  async codeStatus(user: LineIdentity, codeInput: string) {
    const member = await this.member(user);
    const code = await this.ownCode(member.id, codeInput);
    const expired = code.status === RewardCodeStatus.ACTIVE && code.expires_at <= new Date();
    return {
      code: code.code,
      status: expired ? 'EXPIRED' : code.status,
      reward_name: code.reward_name,
      cost_points: code.cost_points,
      used_at: code.used_at,
      order_number: code.order?.order_number ?? null,
      ...(await this.ledger.balance(member.id, this.prisma, code.cost_currency)),
    };
  }

  async cancelCode(user: LineIdentity, codeInput: string) {
    const member = await this.member(user);
    const code = await this.ownCode(member.id, codeInput);
    // an applied code is on an open order at the counter; only the POS can release it
    const { count } = await this.prisma.rewardCode.updateMany({
      where: { id: code.id, status: RewardCodeStatus.ACTIVE },
      data: { status: RewardCodeStatus.CANCELLED, cancelled_at: new Date() },
    });
    if (count === 0) throw new ConflictException({ message: 'Code can no longer be cancelled', reason: code.status });
    return await this.ledger.balance(member.id, this.prisma, code.cost_currency);
  }

  private async ownCode(memberId: string, codeInput: string) {
    const short = normalizeCode(codeInput);
    const code = short && (await this.prisma.rewardCode.findUnique({ where: { code: short }, include: { order: { select: { order_number: true } } } }));
    if (!code || code.member_id !== memberId) throw new NotFoundException({ message: 'Reward code not found', reason: 'NOT_FOUND' });
    return code;
  }
}

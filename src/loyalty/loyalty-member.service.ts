import { BadRequestException, ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PointsEntryType, RewardCodeStatus, Status } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineClient, LineIdentity } from '../line/line.client.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { formatCode, memberLabel, normalizeCode, randomCode, randomSeed } from './function/loyalty-codes.function.js';
import { REWARD_QR_PERIOD_S } from './function/reward-qr.function.js';
import { earnMessage } from './function/line-messages.function.js';

const HISTORY = 30;
const SHOP = 'Ippuku';

// What the LIFF app (customer in LINE) can do. Every call carries a verified LINE identity.
@Injectable()
export class LoyaltyMemberService {
  private readonly logger = new Logger(LoyaltyMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineClient,
    private readonly ledger: LoyaltyLedgerService,
    private readonly program: LoyaltyProgramService,
    private readonly orders: LoyaltyOrderService,
  ) {}

  // A member who accepted the current consent; refreshes name/photo from the LINE profile
  private async member(user: LineIdentity) {
    const member = await this.prisma.member.findUnique({ where: { line_user_id: user.userId } });
    const program = await this.program.get();
    if (!member || member.consent_version !== program.consent_version) {
      throw new ForbiddenException({ message: 'Join the program first', reason: 'NOT_MEMBER' });
    }
    if (member.display_name !== user.name || member.picture_url !== user.picture) {
      return await this.prisma.member.update({ where: { id: member.id }, data: { display_name: user.name, picture_url: user.picture } });
    }
    return member;
  }

  // My Card: membership state, balance, next reward and recent history
  async me(user: LineIdentity) {
    const program = await this.program.get();
    const found = await this.prisma.member.findUnique({ where: { line_user_id: user.userId } });
    const base = {
      profile: { name: user.name, picture: user.picture },
      program: { points_per_unit: program.points_per_unit, unit_satang: program.unit_satang, consent_version: program.consent_version },
    };
    if (!found || found.consent_version !== program.consent_version) {
      // consented to an older version: same member, asked again
      return { ...base, member: null, rejoin: !!found };
    }
    const member = await this.member(user);

    const [balance, history, rewards] = await Promise.all([
      this.ledger.balance(member.id),
      this.prisma.pointsEntry.findMany({
        where: { member_id: member.id },
        orderBy: { create_at: 'desc' },
        take: HISTORY,
        include: { order: { select: { order_number: true } } },
      }),
      this.prisma.reward.findMany({ where: { is_active: true }, orderBy: [{ cost_points: 'asc' }] }),
    ]);
    const next = rewards.find((r) => r.cost_points > balance.available) ?? null;

    return {
      ...base,
      member: {
        label: memberLabel(member.member_no),
        display_name: member.display_name,
        picture_url: member.picture_url,
        joined_at: member.consented_at,
        ...balance,
      },
      next_reward: next && { name: next.name, cost_points: next.cost_points, need: next.cost_points - balance.available },
      history: history.map((e) => ({
        id: e.id,
        type: e.type,
        points: e.points,
        note: e.note,
        order_number: e.order?.order_number ?? null,
        create_at: e.create_at,
      })),
    };
  }

  // PDPA consent: creates the member (or records the newer consent version)
  async join(user: LineIdentity, consentVersion: string) {
    const program = await this.program.get();
    if (consentVersion !== program.consent_version) {
      throw new ConflictException({ message: 'Consent text changed — read it again', reason: 'CONSENT_CHANGED' });
    }
    const now = new Date();
    await this.prisma.member.upsert({
      where: { line_user_id: user.userId },
      create: { line_user_id: user.userId, display_name: user.name, picture_url: user.picture, consent_version: consentVersion, consented_at: now },
      update: { display_name: user.name, picture_url: user.picture, consent_version: consentVersion, consented_at: now },
    });
    return await this.me(user);
  }

  // Receipt QR (token from the URL) or the 6-character code typed from the receipt
  async claim(user: LineIdentity, input: { token?: string; code?: string }) {
    const member = await this.member(user);
    const code = input.code ? normalizeCode(input.code) : null;
    if (!input.token && !code) throw new BadRequestException({ message: 'Not a receipt code', reason: 'INVALID' });
    const where: Prisma.ClaimTokenWhereUniqueInput = input.token ? { token: input.token } : { code: code! };

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claimToken.findUnique({
        where,
        include: { order: { select: { id: true, order_number: true, status: true, paid_at: true } } },
      });
      if (!claim) throw new NotFoundException({ message: 'Receipt code not found', reason: 'NOT_FOUND' });
      if (claim.claimed_at) {
        throw new ConflictException({ message: 'Already claimed', reason: 'CLAIMED', claimed_at: claim.claimed_at, order_number: claim.order.order_number });
      }
      if (claim.order.status !== Status.PAID) {
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

      await tx.pointsEntry.create({
        data: {
          type: PointsEntryType.EARN,
          points: claim.points,
          note: `Receipt #${claim.order.order_number}`,
          member_id: member.id,
          order_id: claim.order.id,
          claim_token_id: claim.id,
        },
      });
      return { claim, balance: await this.ledger.balance(member.id, tx) };
    });

    void this.pushReceipt(member.line_user_id, result.claim.order.id, result.claim.points, result.balance.balance);

    return {
      points: result.claim.points,
      order_number: result.claim.order.order_number,
      total_satang: result.claim.total_satang,
      paid_at: result.claim.order.paid_at,
      ...result.balance,
    };
  }

  private async pushReceipt(to: string, orderId: string, points: number, balance: number) {
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
          balance,
          cardUrl: this.orders.liffUrl() ?? '',
        }),
      ]);
    } catch (err) {
      this.logger.warn(`Receipt push failed: ${(err as Error).message}`);
    }
  }

  // Rewards list with what this member can afford, plus any code they're showing now
  async rewards(user: LineIdentity) {
    const member = await this.member(user);
    const [balance, rewards, active] = await Promise.all([
      this.ledger.balance(member.id),
      this.prisma.reward.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { cost_points: 'asc' }],
        include: { product: { select: { name: true, image_url: true } } },
      }),
      this.prisma.rewardCode.findFirst({
        where: { member_id: member.id, status: RewardCodeStatus.ACTIVE, expires_at: { gt: new Date() } },
        orderBy: { create_at: 'desc' },
      }),
    ]);
    return {
      ...balance,
      rewards: rewards.map((r) => ({
        id: r.id,
        name: r.name,
        cost_points: r.cost_points,
        type: r.type,
        image_url: r.product?.image_url ?? null,
        affordable: balance.available >= r.cost_points,
      })),
      active_code: active && this.codeView(active),
    };
  }

  private codeView(c: { code: string; seed: string; reward_name: string; cost_points: number; expires_at: Date; status: RewardCodeStatus }) {
    return {
      code: c.code,
      display_code: formatCode(c.code),
      seed: c.seed,
      period_s: REWARD_QR_PERIOD_S,
      reward_name: c.reward_name,
      cost_points: c.cost_points,
      expires_at: c.expires_at,
    };
  }

  // Confirm a reward: issues a code that holds the points until it's used, cancelled or expires.
  // Showing a new code cancels the member's previous one.
  async redeem(user: LineIdentity, rewardId: string) {
    const member = await this.member(user);
    const program = await this.program.get();

    const code = await this.prisma.$transaction(async (tx) => {
      await this.ledger.lockMember(tx, member.id);
      const reward = await tx.reward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.is_active) throw new NotFoundException({ message: 'Reward not available', reason: 'NOT_FOUND' });

      await tx.rewardCode.updateMany({
        where: { member_id: member.id, status: RewardCodeStatus.ACTIVE },
        data: { status: RewardCodeStatus.CANCELLED, cancelled_at: new Date() },
      });
      const { available } = await this.ledger.balance(member.id, tx);
      if (available < reward.cost_points) {
        throw new ConflictException({ message: 'Not enough points', reason: 'NOT_ENOUGH', available, cost_points: reward.cost_points });
      }

      let short = randomCode();
      while (await tx.rewardCode.findUnique({ where: { code: short }, select: { id: true } })) short = randomCode();

      return await tx.rewardCode.create({
        data: {
          code: short,
          seed: randomSeed(),
          reward_name: reward.name,
          cost_points: reward.cost_points,
          expires_at: new Date(Date.now() + program.reward_code_minutes * 60 * 1000),
          member_id: member.id,
          reward_id: reward.id,
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
      ...(await this.ledger.balance(member.id)),
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
    return await this.ledger.balance(member.id);
  }

  private async ownCode(memberId: string, codeInput: string) {
    const short = normalizeCode(codeInput);
    const code = short && (await this.prisma.rewardCode.findUnique({ where: { code: short }, include: { order: { select: { order_number: true } } } }));
    if (!code || code.member_id !== memberId) throw new NotFoundException({ message: 'Reward code not found', reason: 'NOT_FOUND' });
    return code;
  }
}

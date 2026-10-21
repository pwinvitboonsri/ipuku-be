import { BadRequestException, ConflictException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { OrderChannel, PointsEntryType, RewardCodeStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineClient } from '../line/line.client.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { pointsForTotal } from './function/points-for-total.function.js';
import { formatCode, memberLabel, randomCode, randomToken } from './function/loyalty-codes.function.js';
import { parseRewardInput, verifyRewardToken } from './function/reward-qr.function.js';
import { DiscountLine, rewardDiscount } from './function/reward-discount.function.js';
import { redeemedMessage, reversalMessage } from './function/line-messages.function.js';

// what pay() hands back so pushes go out after the transaction commits
export interface PaidLoyalty {
  redeemed: { memberId: string; rewardName: string; cost: number; orderNumber: number } | null;
}

export interface RefundLoyalty {
  orderNumber: number;
  deltas: Map<string, number>;
}

// Loyalty steps inside the POS order flow: reward codes on orders, claim QR on payment,
// reversals on refund. The *InTx methods run inside the order's own transaction.
@Injectable()
export class LoyaltyOrderService {
  private readonly logger = new Logger(LoyaltyOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly line: LineClient,
    private readonly ledger: LoyaltyLedgerService,
    private readonly program: LoyaltyProgramService,
  ) {}

  // The QR opens the LIFF app, which claims the token. Off until LINE + LIFF are configured.
  private get liffId(): string | null {
    return this.config.get<boolean>('line.enabled') ? (this.config.get<string>('line.liffId') ?? null) : null;
  }

  liffUrl(query = ''): string | null {
    return this.liffId ? `https://liff.line.me/${this.liffId}${query}` : null;
  }

  claimUrl(token: string): string | null {
    return this.liffUrl(`?claim=${token}`);
  }

  // Order responses: the receipt QR needs the full LIFF link and the printed code
  withClaimUrl<T extends { claim_token?: { token: string; code: string } | null }>(order: T): T {
    if (!order.claim_token) return order;
    const { token, ...rest } = order.claim_token;
    return { ...order, claim_token: { ...rest, url: this.claimUrl(token), display_code: formatCode(rest.code) } };
  }

  // POS "Scan reward": a scanned rotating QR or a typed fallback code. Locks nothing yet;
  // the code is attached when the order is created.
  async validate(input: string) {
    const parsed = parseRewardInput(input);
    if (!parsed) throw new BadRequestException({ message: 'Not a reward code', reason: 'INVALID' });

    const code = await this.prisma.rewardCode.findUnique({
      where: { code: parsed.code },
      include: {
        member: true,
        reward: { include: { product: { select: { id: true, name: true } } } },
        order: { select: { order_number: true } },
      },
    });
    if (!code) throw new NotFoundException({ message: 'Reward code not found', reason: 'NOT_FOUND' });

    this.assertUsable(code);
    // a scanned QR must be the live one; a typed code has no token to check
    if (parsed.token && !verifyRewardToken(code.seed, parsed.token, Date.now())) {
      throw new BadRequestException({ message: 'This QR has changed — scan the screen again', reason: 'STALE_QR' });
    }

    return {
      code: code.code,
      reward_name: code.reward_name,
      cost_points: code.cost_points,
      type: code.reward.type,
      discount_satang: code.reward.discount_satang,
      max_discount_satang: code.reward.max_discount_satang,
      product: code.reward.product,
      expires_at: code.expires_at,
      member: { label: memberLabel(code.member.member_no), display_name: code.member.display_name },
    };
  }

  private assertUsable(code: { status: RewardCodeStatus; expires_at: Date; used_at: Date | null; order?: { order_number: number } | null }) {
    switch (code.status) {
      case RewardCodeStatus.USED:
        throw new ConflictException({ message: 'Code already used', reason: 'USED', used_at: code.used_at });
      case RewardCodeStatus.APPLIED:
        throw new ConflictException({ message: `Code is already on order #${code.order?.order_number ?? '?'}`, reason: 'APPLIED' });
      case RewardCodeStatus.CANCELLED:
        throw new ConflictException({ message: 'Code was cancelled', reason: 'CANCELLED' });
    }
    if (code.expires_at <= new Date()) {
      throw new GoneException({ message: 'Code expired', reason: 'EXPIRED' });
    }
  }

  // Order create: the discount a reward code gives on these lines (the API decides, not the POS)
  async discountInTx(tx: Prisma.TransactionClient, codeInput: string, lines: DiscountLine[], subtotalSatang: number) {
    const parsed = parseRewardInput(codeInput);
    const code = parsed && (await tx.rewardCode.findUnique({ where: { code: parsed.code }, include: { reward: true, order: { select: { order_number: true } } } }));
    if (!code) throw new NotFoundException({ message: 'Reward code not found', reason: 'NOT_FOUND' });
    this.assertUsable(code);

    const discount = rewardDiscount(code.reward, lines, subtotalSatang);
    if (discount === null) {
      throw new BadRequestException({ message: `${code.reward_name} needs its item in the order`, reason: 'ITEM_MISSING' });
    }
    return { rewardCodeId: code.id, discountSatang: discount };
  }

  // Order create, after the row exists: lock the code to it (fails if it changed since the check)
  async attachInTx(tx: Prisma.TransactionClient, rewardCodeId: string, orderId: string, discountSatang: number) {
    const { count } = await tx.rewardCode.updateMany({
      where: { id: rewardCodeId, status: RewardCodeStatus.ACTIVE, expires_at: { gt: new Date() } },
      data: { status: RewardCodeStatus.APPLIED, order_id: orderId, applied_at: new Date(), discount_satang: discountSatang },
    });
    if (count === 0) throw new ConflictException({ message: 'Reward code is no longer valid', reason: 'CHANGED' });
  }

  // Void of an OPEN order: the reward goes back to the customer's screen, with a few minutes to re-use it
  async releaseInTx(tx: Prisma.TransactionClient, orderId: string) {
    const code = await tx.rewardCode.findUnique({ where: { order_id: orderId } });
    if (!code || code.status !== RewardCodeStatus.APPLIED) return;
    const grace = new Date(Date.now() + 5 * 60 * 1000);
    await tx.rewardCode.update({
      where: { id: code.id },
      data: {
        status: RewardCodeStatus.ACTIVE,
        order_id: null,
        applied_at: null,
        discount_satang: null,
        expires_at: code.expires_at > grace ? code.expires_at : grace,
      },
    });
  }

  // Payment: the applied reward is spent, and a walk-in order gets its one-time claim QR
  async onPaidInTx(
    tx: Prisma.TransactionClient,
    order: { id: string; order_number: number; total_satang: number; channel: OrderChannel },
    staffId: string,
  ): Promise<PaidLoyalty> {
    let redeemed: PaidLoyalty['redeemed'] = null;

    const code = await tx.rewardCode.findUnique({ where: { order_id: order.id } });
    if (code?.status === RewardCodeStatus.APPLIED) {
      await tx.rewardCode.update({ where: { id: code.id }, data: { status: RewardCodeStatus.USED, used_at: new Date() } });
      await tx.pointsEntry.create({
        data: {
          type: PointsEntryType.REDEEM,
          points: -code.cost_points,
          note: code.reward_name,
          member_id: code.member_id,
          order_id: order.id,
          reward_code_id: code.id,
          staff_id: staffId,
        },
      });
      redeemed = { memberId: code.member_id, rewardName: code.reward_name, cost: code.cost_points, orderNumber: order.order_number };
    }

    if (order.channel === OrderChannel.WALK_IN && this.liffId) {
      const program = await this.program.get(tx);
      const points = pointsForTotal(order.total_satang, program);
      if (points > 0) {
        await tx.claimToken.create({
          data: {
            order_id: order.id,
            token: randomToken(),
            code: await this.freeCode(tx),
            points,
            total_satang: order.total_satang,
            expires_at: new Date(Date.now() + program.claim_valid_hours * 3600 * 1000),
          },
        });
      }
    }

    return { redeemed };
  }

  // a short code not used by any claim token (checked first: a failed insert would abort the transaction)
  private async freeCode(tx: Prisma.TransactionClient): Promise<string> {
    for (;;) {
      const code = randomCode();
      if (!(await tx.claimToken.findUnique({ where: { code }, select: { id: true } }))) return code;
    }
  }

  // Refund: undo every earn/redeem of the order once; an unclaimed QR stops working.
  // Balances may go below zero if the earned points were already spent (decided: allow negative).
  async reverseInTx(tx: Prisma.TransactionClient, order: { id: string; order_number: number }, staffId: string): Promise<RefundLoyalty> {
    await tx.claimToken.updateMany({ where: { order_id: order.id, claimed_at: null }, data: { expires_at: new Date() } });

    const entries = await tx.pointsEntry.findMany({
      where: { order_id: order.id, type: { in: [PointsEntryType.EARN, PointsEntryType.REDEEM] }, reversed_by: null },
    });
    const deltas = new Map<string, number>();
    for (const e of entries) {
      await tx.pointsEntry.create({
        data: {
          type: PointsEntryType.REVERSAL,
          points: -e.points,
          note: `Refund #${order.order_number}`,
          member_id: e.member_id,
          order_id: order.id,
          staff_id: staffId,
          reverses_id: e.id,
        },
      });
      deltas.set(e.member_id, (deltas.get(e.member_id) ?? 0) - e.points);
    }
    return { orderNumber: order.order_number, deltas };
  }

  // ── pushes after commit; never throw (the ledger is already right)

  async notifyPaid(result: PaidLoyalty) {
    if (!result.redeemed) return;
    const { memberId, rewardName, cost, orderNumber } = result.redeemed;
    await this.pushTo(memberId, async (balance) => redeemedMessage({ rewardName, cost, balance, orderNumber, at: new Date(), cardUrl: this.liffUrl() ?? '' }));
  }

  async notifyRefund(result: RefundLoyalty) {
    for (const [memberId, delta] of result.deltas) {
      if (delta === 0) continue;
      await this.pushTo(memberId, async (balance) => reversalMessage({ orderNumber: result.orderNumber, delta, balance, cardUrl: this.liffUrl() ?? '' }));
    }
  }

  private async pushTo(memberId: string, build: (balance: number) => Promise<object>) {
    try {
      if (!this.liffId) return;
      const member = await this.prisma.member.findUnique({ where: { id: memberId } });
      if (!member) return;
      const { balance } = await this.ledger.balance(memberId);
      await this.line.push(member.line_user_id, [await build(balance)]);
    } catch (err) {
      this.logger.warn(`Loyalty push to member ${memberId} failed: ${(err as Error).message}`);
    }
  }
}

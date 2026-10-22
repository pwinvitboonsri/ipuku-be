import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { CouponSource, LoyaltyCurrency, PerkKind, PointsEntryType, WelcomeTrigger } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineClient } from '../line/line.client.js';
import { birthdayMessage } from './function/line-messages.function.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';

// Thailand has no daylight saving: dates are UTC+7
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
// a birthday missed by a job that didn't run is still granted within this many days
const BIRTHDAY_CATCH_UP_DAYS = 7;

export interface PerkGrantResult {
  kind: PerkKind;
  points: number;
  stamps: number;
  coupon: { reward_name: string; valid_until: Date } | null;
}

// Welcome and birthday perks. Each is granted at most once per period (PerkGrant is the guard),
// so a job or a claim can run twice without giving twice.
@Injectable()
export class LoyaltyPerksService {
  private readonly logger = new Logger(LoyaltyPerksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineClient,
    private readonly orders: LoyaltyOrderService,
  ) {}

  async get(kind: PerkKind, db: Prisma.TransactionClient = this.prisma) {
    const perk = await db.loyaltyPerk.findUnique({ where: { kind }, include: { reward: true } });
    if (perk) return perk;
    return await db.loyaltyPerk.upsert({ where: { kind }, create: { kind }, update: {}, include: { reward: true } });
  }

  // Grants the perk's points/stamps/coupon once for (member, kind, period); null if off or already given
  async grantInTx(tx: Prisma.TransactionClient, memberId: string, kind: PerkKind, period: string, now = new Date()): Promise<PerkGrantResult | null> {
    const perk = await this.get(kind, tx);
    if (!perk.is_active) return null;
    if (perk.grant_points <= 0 && perk.grant_stamps <= 0 && !perk.reward_id) return null;
    // checked first: a failed insert would abort the surrounding transaction
    if (await tx.perkGrant.findUnique({ where: { member_id_kind_period: { member_id: memberId, kind, period } } })) return null;
    await tx.perkGrant.create({ data: { member_id: memberId, kind, period } });

    const note = kind === PerkKind.WELCOME ? 'ต้อนรับสมาชิกใหม่' : 'ของขวัญวันเกิด';
    for (const [currency, amount] of [
      [LoyaltyCurrency.POINTS, perk.grant_points],
      [LoyaltyCurrency.STAMPS, perk.grant_stamps],
    ] as const) {
      if (amount > 0) await tx.pointsEntry.create({ data: { type: PointsEntryType.BONUS, currency, points: amount, note, member_id: memberId } });
    }

    let coupon: PerkGrantResult['coupon'] = null;
    if (perk.reward_id && perk.reward) {
      const valid_until = new Date(now.getTime() + perk.coupon_valid_days * 24 * 3600 * 1000);
      await tx.memberCoupon.create({
        data: { member_id: memberId, reward_id: perk.reward_id, source: kind === PerkKind.WELCOME ? CouponSource.WELCOME : CouponSource.BIRTHDAY, valid_until, note },
      });
      coupon = { reward_name: perk.reward.name, valid_until };
    }
    return { kind, points: perk.grant_points, stamps: perk.grant_stamps, coupon };
  }

  // On join, or on the first receipt claim, depending on the welcome perk's trigger
  async welcomeInTx(tx: Prisma.TransactionClient, memberId: string, trigger: WelcomeTrigger) {
    const perk = await this.get(PerkKind.WELCOME, tx);
    if (perk.trigger !== trigger) return null;
    return await this.grantInTx(tx, memberId, PerkKind.WELCOME, 'once');
  }

  // Daily job: members whose birthday (Thailand date) fell in the last few days and weren't given this year's perk
  async runBirthdays(now = new Date()): Promise<number> {
    const perk = await this.get(PerkKind.BIRTHDAY);
    if (!perk.is_active) return 0;

    const days = Array.from({ length: BIRTHDAY_CATCH_UP_DAYS }, (_, i) => {
      const d = new Date(now.getTime() + BANGKOK_OFFSET_MS - i * 24 * 3600 * 1000);
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    });
    const year = days[0].year;
    const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const members = await this.prisma.member.findMany({
      where: { birth_month: { in: [...new Set(days.map((d) => d.month))] }, birth_day: { not: null } },
    });

    let granted = 0;
    for (const m of members) {
      // 29 Feb birthdays are celebrated on 28 Feb in other years
      const day = m.birth_month === 2 && m.birth_day === 29 && !leap(year) ? 28 : m.birth_day;
      if (!days.some((d) => d.month === m.birth_month && d.day === day && d.year === year)) continue;
      const result = await this.prisma.$transaction((tx) => this.grantInTx(tx, m.id, PerkKind.BIRTHDAY, String(year), now));
      if (!result) continue;
      granted++;
      if (perk.send_message) {
        await this.line
          .push(m.line_user_id, [birthdayMessage({ name: m.display_name, ...result, cardUrl: this.orders.liffUrl('?v=rewards') ?? '' })])
          .catch((err: Error) => this.logger.warn(`Birthday push failed: ${err.message}`));
      }
    }
    return granted;
  }
}

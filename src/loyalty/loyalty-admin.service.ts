import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuditAction, EarnRuleKind, LoyaltyCurrency, PerkKind, PointsEntryType, RewardType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { LoyaltyPerksService } from './loyalty-perks.service.js';
import { validBirthday } from './function/birthday.function.js';
import { EarnRuleDTO } from './dto/earn-rule.dto.js';
import { UpdatePerkDTO } from './dto/perk.dto.js';
import { AdjustPointsDTO, MemberBirthdayDTO } from './dto/member-admin.dto.js';
import { memberLabel } from './function/loyalty-codes.function.js';
import { UpdateProgramDTO } from './dto/update-program.dto.js';
import { CreateRewardDTO, ListMembersDTO, UpdateRewardDTO } from './dto/reward.dto.js';
import { ListActivityDTO } from './dto/activity.dto.js';

interface Actor {
  staffId: string;
  ip?: string;
  userAgent?: string;
}

// Back office → Loyalty (owner): program rule, rewards, members, activity log
@Injectable()
export class LoyaltyAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly program: LoyaltyProgramService,
    private readonly orders: LoyaltyOrderService,
    private readonly perks: LoyaltyPerksService,
  ) {}

  async getProgram() {
    const program = await this.program.get();
    // whether the receipt QR can work at all (LINE on + LIFF ID set)
    return { ...program, claim_qr_enabled: this.orders.liffUrl() !== null };
  }

  async updateProgram(dto: UpdateProgramDTO, actor: Actor) {
    await this.program.get();
    const program = await this.prisma.loyaltyProgram.update({ where: { id: 1 }, data: { ...dto, update_by_staff_id: actor.staffId } });
    await this.audit.log({
      staffId: actor.staffId,
      action: AuditAction.UPDATE_LOYALTY_PROGRAM,
      entityType: 'LoyaltyProgram',
      entityId: '1',
      metadata: { ...dto },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });
    return { ...program, claim_qr_enabled: this.orders.liffUrl() !== null };
  }

  async listRewards() {
    return await this.prisma.reward.findMany({
      orderBy: [{ is_active: 'desc' }, { sort_order: 'asc' }, { cost_points: 'asc' }],
      include: { product: { select: { id: true, name: true, price_satang: true, image_url: true } } },
    });
  }

  // only the fields that belong to the type are kept
  // only the fields that belong to the type are kept; the rest are cleared
  private rewardData(dto: CreateRewardDTO) {
    const t = dto.type;
    const is = (...types: RewardType[]) => types.includes(t);
    return {
      name: dto.name.trim(),
      cost_points: dto.cost_points,
      cost_currency: dto.cost_currency ?? LoyaltyCurrency.POINTS,
      type: t,
      discount_satang: is(RewardType.FIXED_DISCOUNT) ? dto.discount_satang! : null,
      product_id: is(RewardType.FREE_ITEM) ? dto.product_id! : null,
      max_discount_satang: is(RewardType.FIXED_DISCOUNT) ? null : (dto.max_discount_satang ?? null),
      percent: is(RewardType.PERCENT_OFF) ? dto.percent! : null,
      min_spend_satang: dto.min_spend_satang || null,
      option_ids: is(RewardType.FREE_OPTION) ? (dto.option_ids ?? []) : [],
      product_ids: is(RewardType.PERCENT_OFF, RewardType.FREE_OPTION, RewardType.BUY_X_GET_Y) ? (dto.product_ids ?? []) : [],
      category_ids: is(RewardType.PERCENT_OFF, RewardType.FREE_OPTION, RewardType.BUY_X_GET_Y) ? (dto.category_ids ?? []) : [],
      buy_qty: is(RewardType.BUY_X_GET_Y) ? dto.buy_qty! : null,
      get_qty: is(RewardType.BUY_X_GET_Y) ? dto.get_qty! : null,
      get_percent: is(RewardType.BUY_X_GET_Y) ? dto.get_percent! : null,
      starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
      ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
      combine_with_promotions: dto.combine_with_promotions ?? true,
      sort_order: dto.sort_order ?? 0,
      image_url: dto.image_url ?? null,
    };
  }

  private async assertProduct(dto: CreateRewardDTO) {
    if (dto.type === RewardType.FREE_ITEM) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.product_id! } });
      if (!product) throw new BadRequestException('Product not found');
    }
    if (dto.type === RewardType.FREE_OPTION && !dto.option_ids?.length) throw new BadRequestException('Choose at least one option');
    if (dto.starts_at && dto.ends_at && new Date(dto.ends_at) <= new Date(dto.starts_at)) throw new BadRequestException('End must be after start');
  }

  // ── earn rules

  async listEarnRules() {
    return await this.prisma.earnRule.findMany({ orderBy: [{ is_active: 'desc' }, { sort_order: 'asc' }, { create_at: 'asc' }] });
  }

  private earnRuleData(dto: EarnRuleDTO) {
    if ((dto.time_from == null) !== (dto.time_to == null)) throw new BadRequestException('Set both a start and an end time');
    if (dto.starts_at && dto.ends_at && new Date(dto.ends_at) <= new Date(dto.starts_at)) throw new BadRequestException('End must be after start');
    const multiplier = dto.kind === EarnRuleKind.MULTIPLIER;
    if (multiplier && !dto.multiplier_x10) throw new BadRequestException('Set the multiplier');
    if (!multiplier && !dto.amount) throw new BadRequestException('Set how many points or stamps');
    return {
      name: dto.name.trim(),
      kind: dto.kind,
      amount: multiplier ? 0 : (dto.amount ?? 0),
      // stamps-per-visit always gives stamps
      currency: dto.kind === EarnRuleKind.STAMPS_PER_VISIT ? LoyaltyCurrency.STAMPS : (dto.currency ?? LoyaltyCurrency.POINTS),
      multiplier_x10: multiplier ? dto.multiplier_x10! : 10,
      per_item: !multiplier && (dto.per_item ?? false),
      min_spend_satang: dto.min_spend_satang ?? 0,
      min_items: dto.min_items ?? 0,
      product_ids: dto.product_ids ?? [],
      category_ids: dto.category_ids ?? [],
      weekdays: [...new Set(dto.weekdays ?? [])].sort(),
      time_from: dto.time_from ?? null,
      time_to: dto.time_to ?? null,
      starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
      ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
      stackable: multiplier && (dto.stackable ?? false),
      sort_order: dto.sort_order ?? 0,
    };
  }

  async createEarnRule(dto: EarnRuleDTO, actor: Actor) {
    const rule = await this.prisma.earnRule.create({ data: this.earnRuleData(dto) });
    await this.log(AuditAction.CREATE_EARN_RULE, 'EarnRule', rule.id, { ...dto }, actor);
    return rule;
  }

  async updateEarnRule(id: string, dto: EarnRuleDTO, actor: Actor) {
    const rule = await this.prisma.earnRule.update({ where: { id }, data: this.earnRuleData(dto) });
    await this.log(AuditAction.UPDATE_EARN_RULE, 'EarnRule', id, { ...dto }, actor);
    return rule;
  }

  async updateEarnRuleStatus(id: string, isActive: boolean, actor: Actor) {
    const rule = await this.prisma.earnRule.update({ where: { id }, data: { is_active: isActive } });
    await this.log(isActive ? AuditAction.ACTIVE_EARN_RULE : AuditAction.DEACTIVATE_EARN_RULE, 'EarnRule', id, { is_active: isActive }, actor);
    return rule;
  }

  // ── perks (welcome / birthday)

  async listPerks() {
    return await Promise.all([this.perks.get(PerkKind.WELCOME), this.perks.get(PerkKind.BIRTHDAY)]);
  }

  async updatePerk(kind: PerkKind, dto: UpdatePerkDTO, actor: Actor) {
    await this.perks.get(kind);
    if (dto.reward_id) {
      const reward = await this.prisma.reward.findUnique({ where: { id: dto.reward_id } });
      if (!reward) throw new BadRequestException('Reward not found');
    }
    const perk = await this.prisma.loyaltyPerk.update({ where: { kind }, data: { ...dto }, include: { reward: true } });
    await this.log(AuditAction.UPDATE_LOYALTY_PERK, 'LoyaltyPerk', kind, { ...dto }, actor);
    return perk;
  }

  // ── member corrections

  async adjustPoints(memberId: string, dto: AdjustPointsDTO, actor: Actor) {
    const entry = await this.prisma.pointsEntry.create({
      data: { type: PointsEntryType.ADJUST, currency: dto.currency, points: dto.amount, note: dto.reason.trim(), member_id: memberId, staff_id: actor.staffId },
    });
    await this.log(AuditAction.ADJUST_POINTS, 'Member', memberId, { currency: dto.currency, amount: dto.amount, reason: dto.reason }, actor);
    return entry;
  }

  async setBirthday(memberId: string, dto: MemberBirthdayDTO, actor: Actor) {
    if (dto.birth_day != null && !validBirthday(dto.birth_day, dto.birth_month!)) throw new BadRequestException('Not a real date');
    const member = await this.prisma.member.update({ where: { id: memberId }, data: { birth_day: dto.birth_day, birth_month: dto.birth_month } });
    await this.log(AuditAction.UPDATE_LOYALTY_PERK, 'Member', memberId, { birth_day: dto.birth_day, birth_month: dto.birth_month }, actor);
    return { id: member.id, birth_day: member.birth_day, birth_month: member.birth_month };
  }

  private async log(action: AuditAction, entityType: string, id: string, metadata: Prisma.InputJsonValue, actor: Actor) {
    await this.audit.log({ staffId: actor.staffId, action, entityType, entityId: id, metadata, ipAddress: actor.ip, userAgent: actor.userAgent });
  }

  async createReward(dto: CreateRewardDTO, actor: Actor) {
    await this.assertProduct(dto);
    const reward = await this.prisma.reward.create({ data: this.rewardData(dto) });
    await this.logReward(AuditAction.CREATE_REWARD, reward.id, { ...dto }, actor);
    return reward;
  }

  // Codes already issued keep their name/cost snapshot and still work until they expire
  async updateReward(id: string, dto: UpdateRewardDTO, actor: Actor) {
    await this.assertProduct(dto);
    const reward = await this.prisma.reward.update({ where: { id }, data: this.rewardData(dto) });
    await this.logReward(AuditAction.UPDATE_REWARD, id, { ...dto }, actor);
    return reward;
  }

  async updateRewardStatus(id: string, isActive: boolean, actor: Actor) {
    const reward = await this.prisma.reward.update({ where: { id }, data: { is_active: isActive } });
    await this.logReward(isActive ? AuditAction.ACTIVE_REWARD : AuditAction.DEACTIVATE_REWARD, id, { is_active: isActive }, actor);
    return reward;
  }

  private async logReward(action: AuditAction, id: string, metadata: Prisma.InputJsonValue, actor: Actor) {
    await this.audit.log({ staffId: actor.staffId, action, entityType: 'Reward', entityId: id, metadata, ipAddress: actor.ip, userAgent: actor.userAgent });
  }

  // Members with balance (from the ledger), visits (= receipts claimed), last visit
  async listMembers(dto: ListMembersDTO) {
    const q = dto.q?.trim();
    const no = q && /^(ipk-?)?0*\d+$/i.test(q) ? Number(q.replace(/\D/g, '')) : null;
    const where: Prisma.MemberWhereInput = q
      ? { OR: [...(no ? [{ member_no: no }] : []), { display_name: { contains: q, mode: 'insensitive' } }] }
      : {};

    const [total, members] = await Promise.all([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({ where, orderBy: { create_at: 'desc' }, take: dto.limit ?? 50 }),
    ]);
    const ids = members.map((m) => m.id);
    const [sums, visits] = await Promise.all([
      this.prisma.pointsEntry.groupBy({ by: ['member_id', 'currency'], where: { member_id: { in: ids } }, _sum: { points: true } }),
      this.prisma.pointsEntry.groupBy({
        by: ['member_id'],
        where: { member_id: { in: ids }, type: PointsEntryType.EARN },
        _count: { _all: true },
        _max: { create_at: true },
      }),
    ]);
    const sumBy = new Map(sums.map((s) => [`${s.member_id}:${s.currency}`, s._sum.points ?? 0]));
    const visitBy = new Map(visits.map((v) => [v.member_id, v]));

    return {
      total,
      members: members.map((m) => ({
        id: m.id,
        label: memberLabel(m.member_no),
        display_name: m.display_name,
        picture_url: m.picture_url,
        balance: sumBy.get(`${m.id}:${LoyaltyCurrency.POINTS}`) ?? 0,
        stamps: sumBy.get(`${m.id}:${LoyaltyCurrency.STAMPS}`) ?? 0,
        birthday: m.birth_day && m.birth_month ? { day: m.birth_day, month: m.birth_month } : null,
        visits: visitBy.get(m.id)?._count._all ?? 0,
        last_visit_at: visitBy.get(m.id)?._max.create_at ?? null,
        joined_at: m.consented_at,
      })),
    };
  }

  // Read-only ledger, newest first
  async listActivity(dto: ListActivityDTO) {
    const rows = await this.prisma.pointsEntry.findMany({
      where: { ...(dto.type && { type: dto.type }), ...(dto.member_id && { member_id: dto.member_id }) },
      orderBy: { create_at: 'desc' },
      take: dto.limit ?? 100,
      include: {
        member: { select: { id: true, member_no: true, display_name: true } },
        order: { select: { order_number: true } },
        staff: { select: { name: true } },
      },
    });
    return rows.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points,
      note: e.note,
      create_at: e.create_at,
      member: { id: e.member.id, label: memberLabel(e.member.member_no), display_name: e.member.display_name },
      order_number: e.order?.order_number ?? null,
      // earns come from the customer in LINE, everything else from a staff action
      by: e.staff?.name ?? 'LINE',
    }));
  }
}

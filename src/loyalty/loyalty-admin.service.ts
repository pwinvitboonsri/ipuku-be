import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuditAction, PointsEntryType, RewardType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
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
      include: { product: { select: { id: true, name: true, price_satang: true } } },
    });
  }

  // only the fields that belong to the type are kept
  private rewardData(dto: CreateRewardDTO) {
    const fixed = dto.type === RewardType.FIXED_DISCOUNT;
    return {
      name: dto.name.trim(),
      cost_points: dto.cost_points,
      type: dto.type,
      discount_satang: fixed ? dto.discount_satang! : null,
      product_id: fixed ? null : dto.product_id!,
      max_discount_satang: fixed ? null : dto.max_discount_satang!,
      sort_order: dto.sort_order ?? 0,
    };
  }

  private async assertProduct(dto: CreateRewardDTO) {
    if (dto.type !== RewardType.FREE_ITEM) return;
    const product = await this.prisma.product.findUnique({ where: { id: dto.product_id! } });
    if (!product) throw new BadRequestException('Product not found');
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
      this.prisma.pointsEntry.groupBy({ by: ['member_id'], where: { member_id: { in: ids } }, _sum: { points: true } }),
      this.prisma.pointsEntry.groupBy({
        by: ['member_id'],
        where: { member_id: { in: ids }, type: PointsEntryType.EARN },
        _count: { _all: true },
        _max: { create_at: true },
      }),
    ]);
    const sumBy = new Map(sums.map((s) => [s.member_id, s._sum.points ?? 0]));
    const visitBy = new Map(visits.map((v) => [v.member_id, v]));

    return {
      total,
      members: members.map((m) => ({
        id: m.id,
        label: memberLabel(m.member_no),
        display_name: m.display_name,
        picture_url: m.picture_url,
        balance: sumBy.get(m.id) ?? 0,
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

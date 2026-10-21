import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { RewardCodeStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PointsBalance {
  /// sum of the ledger
  balance: number;
  /// held by reward codes shown in LINE (unexpired) or applied to an open order
  held: number;
  /// what the member can spend now
  available: number;
}

// Balances come only from the ledger; holds come from live reward codes.
@Injectable()
export class LoyaltyLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // reward codes that still hold points at `now`
  static holdingWhere(now: Date): Prisma.RewardCodeWhereInput {
    return {
      OR: [{ status: RewardCodeStatus.ACTIVE, expires_at: { gt: now } }, { status: RewardCodeStatus.APPLIED }],
    };
  }

  async balance(memberId: string, db: Prisma.TransactionClient = this.prisma): Promise<PointsBalance> {
    // one after the other: inside a transaction both queries share one connection
    const sum = await db.pointsEntry.aggregate({ where: { member_id: memberId }, _sum: { points: true } });
    const held = await db.rewardCode.aggregate({
      where: { member_id: memberId, ...LoyaltyLedgerService.holdingWhere(new Date()) },
      _sum: { cost_points: true },
    });
    const balance = sum._sum.points ?? 0;
    const heldPts = held._sum.cost_points ?? 0;
    return { balance, held: heldPts, available: balance - heldPts };
  }

  // Serializes a member's spend/earn inside a transaction (two taps can't both pass a balance check)
  async lockMember(tx: Prisma.TransactionClient, memberId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
  }
}

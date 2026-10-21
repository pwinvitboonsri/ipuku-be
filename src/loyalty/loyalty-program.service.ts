import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// The single settings row (id 1), created with defaults on first read
@Injectable()
export class LoyaltyProgramService {
  constructor(private readonly prisma: PrismaService) {}

  async get(db: Prisma.TransactionClient = this.prisma) {
    return await db.loyaltyProgram.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  }
}

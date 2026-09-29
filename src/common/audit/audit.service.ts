import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditAction } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';

interface CreateAuditLogParams {
  staffId: string;
  action: AuditAction;

  entityType: string;
  entityId?: string;

  metadata?: Prisma.InputJsonValue;

  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        staff_id: params.staffId,
        action: params.action,

        entity_type: params.entityType,
        entity_id: params.entityId,

        metadata: params.metadata,

        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      },
    });
  }
}
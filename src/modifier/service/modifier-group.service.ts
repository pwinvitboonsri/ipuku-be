import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuditAction } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateModifierGroupDTO } from '../dto/create-modifier-group.dto.js';
import { UpdateModifierGroupDTO } from '../dto/update-modifier-group.dto.js';
import { GetByIdDTO } from '../dto/get-by-id.dto.js';
import { optionInclude } from '../function/active-option.include.js';
import {
  assertGroupSelectable,
  assertMinMax,
} from '../function/assert-group-selectable.function.js';

@Injectable()
export class ModifierGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(includeInactive = false) {
    return await this.prisma.modifierGroup.findMany({
      where: {
        ...(!includeInactive && { is_active: true }),
      },
      include: optionInclude(includeInactive),
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getById(dto: GetByIdDTO, includeInactive = false) {
    return await this.prisma.modifierGroup.findUniqueOrThrow({
      where: {
        id: dto.id,
        ...(!includeInactive && { is_active: true }),
      },
      include: optionInclude(includeInactive),
    });
  }

  async create(
    dto: CreateModifierGroupDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    assertMinMax(dto.min_select, dto.max_select);

    const result = await this.prisma.modifierGroup.create({
      data: {
        name: dto.name,
        min_select: dto.min_select,
        max_select: dto.max_select,
        is_active: dto.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_MODIFIER_GROUP,
      entityType: 'ModifierGroup',
      entityId: result.id,
      metadata: {
        createData: {
          name: result.name,
          min_select: result.min_select,
          max_select: result.max_select,
          is_active: result.is_active,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateModifierGroupDTO,
    groupId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.modifierGroup.findUniqueOrThrow({
      where: {
        id: groupId,
        is_active: true,
      },
    });

    const changedFields: string[] = [];

    const before: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: oldData.name,
        }),

      ...(dto.min_select !== undefined &&
        dto.min_select !== oldData.min_select && {
          min_select: oldData.min_select,
        }),

      ...(dto.max_select !== undefined &&
        dto.max_select !== oldData.max_select && {
          max_select: oldData.max_select,
        }),
    };

    const after: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: dto.name,
        }),

      ...(dto.min_select !== undefined &&
        dto.min_select !== oldData.min_select && {
          min_select: dto.min_select,
        }),

      ...(dto.max_select !== undefined &&
        dto.max_select !== oldData.max_select && {
          max_select: dto.max_select,
        }),
    };

    if (dto.name !== undefined && dto.name !== oldData.name) {
      changedFields.push('name');
    }

    if (dto.min_select !== undefined && dto.min_select !== oldData.min_select) {
      changedFields.push('min_select');
    }

    if (dto.max_select !== undefined && dto.max_select !== oldData.max_select) {
      changedFields.push('max_select');
    }

    if (changedFields.length === 0) {
      throw new BadRequestException('No changes detected');
    }

    const minSelect = dto.min_select ?? oldData.min_select;
    const maxSelect = dto.max_select ?? oldData.max_select;

    assertMinMax(minSelect, maxSelect);

    if (minSelect > oldData.min_select) {
      await assertGroupSelectable(this.prisma, groupId, minSelect, {
        onlyIfAttached: true,
      });
    }

    const newData = await this.prisma.modifierGroup.update({
      where: {
        id: groupId,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.min_select !== undefined && {
          min_select: dto.min_select,
        }),

        ...(dto.max_select !== undefined && {
          max_select: dto.max_select,
        }),
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_MODIFIER_GROUP,
      entityType: 'ModifierGroup',
      entityId: groupId,
      metadata: {
        changedFields,
        before,
        after,
      },
      ipAddress: ip,
      userAgent,
    });

    return newData;
  }

  async updateStatus(
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const group = await this.prisma.modifierGroup.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    // re-activating must not expose a group that can't be completed
    if (!group.is_active) {
      await assertGroupSelectable(this.prisma, id, group.min_select, {
        onlyIfAttached: true,
      });
    }

    const result = await this.prisma.modifierGroup.update({
      where: {
        id: id,
      },
      data: {
        is_active: !group.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: result.is_active
        ? AuditAction.ACTIVE_MODIFIER_GROUP
        : AuditAction.DEACTIVATE_MODIFIER_GROUP,
      entityType: 'ModifierGroup',
      entityId: id,
      metadata: {
        changedField: ['is_active'],
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }
}

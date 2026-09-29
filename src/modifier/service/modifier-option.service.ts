import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuditAction } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateModifierOptionDTO } from '../dto/create-modifier-option.dto.js';
import { UpdateModifierOptionDTO } from '../dto/update-modifier-option.dto.js';
import { assertGroupSelectable } from '../function/assert-group-selectable.function.js';

@Injectable()
export class ModifierOptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateModifierOptionDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    await this.prisma.modifierGroup.findUniqueOrThrow({
      where: {
        id: dto.group_id,
      },
    });

    const result = await this.prisma.modifierOption.create({
      data: {
        group_id: dto.group_id,
        name: dto.name,
        price_delta_satang: dto.price_delta_satang,
        sort_order: dto.sort_order,
        is_active: dto.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_MODIFIER_OPTION,
      entityType: 'ModifierOption',
      entityId: result.id,
      metadata: {
        createData: {
          group_id: result.group_id,
          name: result.name,
          price_delta_satang: result.price_delta_satang,
          sort_order: result.sort_order,
          is_active: result.is_active,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateModifierOptionDTO,
    optionId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.modifierOption.findUniqueOrThrow({
      where: {
        id: optionId,
      },
    });

    const changedFields: string[] = [];

    const before: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: oldData.name,
        }),

      ...(dto.price_delta_satang !== undefined &&
        dto.price_delta_satang !== oldData.price_delta_satang && {
          price_delta_satang: oldData.price_delta_satang,
        }),

      ...(dto.sort_order !== undefined &&
        dto.sort_order !== oldData.sort_order && {
          sort_order: oldData.sort_order,
        }),
    };

    const after: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: dto.name,
        }),

      ...(dto.price_delta_satang !== undefined &&
        dto.price_delta_satang !== oldData.price_delta_satang && {
          price_delta_satang: dto.price_delta_satang,
        }),

      ...(dto.sort_order !== undefined &&
        dto.sort_order !== oldData.sort_order && {
          sort_order: dto.sort_order,
        }),
    };

    if (dto.name !== undefined && dto.name !== oldData.name) {
      changedFields.push('name');
    }

    if (
      dto.price_delta_satang !== undefined &&
      dto.price_delta_satang !== oldData.price_delta_satang
    ) {
      changedFields.push('price_delta_satang');
    }

    if (dto.sort_order !== undefined && dto.sort_order !== oldData.sort_order) {
      changedFields.push('sort_order');
    }

    if (changedFields.length === 0) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.modifierOption.update({
      where: {
        id: optionId,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.price_delta_satang !== undefined && {
          price_delta_satang: dto.price_delta_satang,
        }),

        ...(dto.sort_order !== undefined && {
          sort_order: dto.sort_order,
        }),
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_MODIFIER_OPTION,
      entityType: 'ModifierOption',
      entityId: optionId,
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
    const option = await this.prisma.modifierOption.findUniqueOrThrow({
      where: {
        id: id,
      },
      include: {
        modifier_group: true,
      },
    });

    // deactivating must leave enough active options for min_select
    if (option.is_active && option.modifier_group.is_active) {
      await assertGroupSelectable(
        this.prisma,
        option.group_id,
        option.modifier_group.min_select,
        { onlyIfAttached: true, excludeOptionId: id },
      );
    }

    const result = await this.prisma.modifierOption.update({
      where: {
        id: id,
      },
      data: {
        is_active: !option.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: result.is_active
        ? AuditAction.ACTIVE_MODIFIER_OPTION
        : AuditAction.DEACTIVATE_MODIFIER_OPTION,
      entityType: 'ModifierOption',
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

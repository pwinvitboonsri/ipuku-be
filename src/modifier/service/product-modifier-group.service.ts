import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuditAction } from '../../generated/prisma/enums.js';
import { AttachModifierGroupDTO } from '../dto/attach-modifier-group.dto.js';
import { UpdateProductModifierGroupDTO } from '../dto/update-product-modifier-group.dto.js';
import { ProductModifierGroupKeyDTO } from '../dto/product-modifier-group-key.dto.js';
import { GetByProductDTO } from '../dto/get-by-product.dto.js';
import { activeOptionInclude } from '../function/active-option.include.js';
import { assertGroupSelectable } from '../function/assert-group-selectable.function.js';

@Injectable()
export class ProductModifierGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByProduct(dto: GetByProductDTO) {
    return await this.prisma.productModifierGroup.findMany({
      where: {
        product_id: dto.productId,
        modifier_group: {
          is_active: true,
        },
      },
      include: {
        modifier_group: {
          include: activeOptionInclude,
        },
      },
      orderBy: {
        sort_order: 'asc',
      },
    });
  }

  async attach(
    dto: AttachModifierGroupDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    await this.prisma.product.findUniqueOrThrow({
      where: {
        id: dto.product_id,
        is_active: true,
      },
    });

    const group = await this.prisma.modifierGroup.findUniqueOrThrow({
      where: {
        id: dto.modifier_group_id,
        is_active: true,
      },
    });

    await assertGroupSelectable(this.prisma, group.id, group.min_select);

    const result = await this.prisma.productModifierGroup.create({
      data: {
        product_id: dto.product_id,
        modifier_group_id: dto.modifier_group_id,
        sort_order: dto.sort_order,
      },
      include: {
        modifier_group: {
          include: activeOptionInclude,
        },
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.ATTACH_MODIFIER_GROUP,
      entityType: 'ProductModifierGroup',
      entityId: dto.product_id,
      metadata: {
        createData: {
          product_id: dto.product_id,
          modifier_group_id: dto.modifier_group_id,
          sort_order: dto.sort_order,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateProductModifierGroupDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.productModifierGroup.findUniqueOrThrow({
      where: {
        product_id_modifier_group_id: {
          product_id: dto.product_id,
          modifier_group_id: dto.modifier_group_id,
        },
      },
    });

    if (dto.sort_order === oldData.sort_order) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.productModifierGroup.update({
      where: {
        product_id_modifier_group_id: {
          product_id: dto.product_id,
          modifier_group_id: dto.modifier_group_id,
        },
      },
      data: {
        sort_order: dto.sort_order,
      },
      include: {
        modifier_group: {
          include: activeOptionInclude,
        },
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_PRODUCT_MODIFIER_GROUP,
      entityType: 'ProductModifierGroup',
      entityId: dto.product_id,
      metadata: {
        modifier_group_id: dto.modifier_group_id,
        changedFields: ['sort_order'],
        before: {
          sort_order: oldData.sort_order,
        },
        after: {
          sort_order: dto.sort_order,
        },
      },
      ipAddress: ip,
      userAgent,
    });

    return newData;
  }

  async detach(
    dto: ProductModifierGroupKeyDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const key = {
      product_id_modifier_group_id: {
        product_id: dto.product_id,
        modifier_group_id: dto.modifier_group_id,
      },
    };

    await this.prisma.productModifierGroup.findUniqueOrThrow({
      where: key,
    });

    const result = await this.prisma.productModifierGroup.delete({
      where: key,
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.DETACH_MODIFIER_GROUP,
      entityType: 'ProductModifierGroup',
      entityId: dto.product_id,
      metadata: {
        deletedData: {
          product_id: result.product_id,
          modifier_group_id: result.modifier_group_id,
          sort_order: result.sort_order,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateIngredientDTO } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDTO } from './dto/update-ingredient.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';

@Injectable()
export class IngredientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(includeInactive = false) {
    return await this.prisma.ingredient.findMany({
      where: {
        ...(!includeInactive && { is_active: true }),
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getLowStock() {
    return await this.prisma.ingredient.findMany({
      where: {
        is_active: true,
        stock_quantity: {
          lte: this.prisma.ingredient.fields.reorder_level,
        },
      },
      orderBy: {
        stock_quantity: 'asc',
      },
    });
  }

  async getById(dto: GetByIdDTO, includeInactive = false) {
    return await this.prisma.ingredient.findUniqueOrThrow({
      where: {
        id: dto.id,
        ...(!includeInactive && { is_active: true }),
      },
    });
  }

  async create(
    dto: CreateIngredientDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const result = await this.prisma.ingredient.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        stock_quantity: dto.stock_quantity,
        reorder_level: dto.reorder_level,
        is_active: dto.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_INGREDIENT,
      entityType: 'Ingredient',
      entityId: result.id,
      metadata: {
        createData: {
          name: result.name,
          unit: result.unit,
          stock_quantity: result.stock_quantity,
          reorder_level: result.reorder_level,
          is_active: result.is_active,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateIngredientDTO,
    ingredientId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.ingredient.findUniqueOrThrow({
      where: {
        id: ingredientId,
        is_active: true,
      },
    });

    const changedFields: string[] = [];

    const before: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: oldData.name,
        }),

      ...(dto.unit !== undefined &&
        dto.unit !== oldData.unit && {
          unit: oldData.unit,
        }),

      ...(dto.reorder_level !== undefined &&
        dto.reorder_level !== oldData.reorder_level && {
          reorder_level: oldData.reorder_level,
        }),
    };

    const after: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: dto.name,
        }),

      ...(dto.unit !== undefined &&
        dto.unit !== oldData.unit && {
          unit: dto.unit,
        }),

      ...(dto.reorder_level !== undefined &&
        dto.reorder_level !== oldData.reorder_level && {
          reorder_level: dto.reorder_level,
        }),
    };

    if (dto.name !== undefined && dto.name !== oldData.name) {
      changedFields.push('name');
    }

    if (dto.unit !== undefined && dto.unit !== oldData.unit) {
      changedFields.push('unit');
    }

    if (
      dto.reorder_level !== undefined &&
      dto.reorder_level !== oldData.reorder_level
    ) {
      changedFields.push('reorder_level');
    }

    if (changedFields.length === 0) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.ingredient.update({
      where: {
        id: ingredientId,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.unit !== undefined && {
          unit: dto.unit,
        }),

        ...(dto.reorder_level !== undefined && {
          reorder_level: dto.reorder_level,
        }),
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_INGREDIENT,
      entityType: 'Ingredient',
      entityId: ingredientId,
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
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const result = await this.prisma.ingredient.update({
      where: {
        id: id,
      },
      data: {
        is_active: !ingredient.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: result.is_active
        ? AuditAction.ACTIVE_INGREDIENT
        : AuditAction.DEACTIVATE_INGREDIENT,
      entityType: 'Ingredient',
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

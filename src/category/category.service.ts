import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { sortData } from './function/sortCategory.function.js';
import { CreateDTO } from './dto/create.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { UpdateCategoryDTO } from './dto/update.dto.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(includeInactive = false) {
    const result = await this.prisma.category.findMany({
      where: {
        ...(!includeInactive && { is_active: true }),
      },
    });

    return sortData(result, 'sort_order');
  }

  async getById(dto: GetByIdDTO, includeInactive = false) {
    return await this.prisma.category.findUniqueOrThrow({
      where: {
        id: dto.id,
        ...(!includeInactive && { is_active: true }),
      },
    });
  }

  async create(
    dto: CreateDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const result = await this.prisma.category.create({
      data: {
        name: dto.name,
        sort_order: dto.sort_order,
        is_active: dto.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_CATEGORY,
      entityType: 'Category',
      entityId: result.id,
      metadata: {
        createData: {
          name: result.name,
          sortOrder: result.sort_order,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateCategoryDTO,
    categoryId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.category.findUniqueOrThrow({
      where: {
        id: categoryId,
        is_active: true,
      },
    });

    const changedFields: string[] = [];

    const before: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: oldData.name,
        }),

      ...(dto.sort_order !== undefined &&
        dto.sort_order !== oldData.sort_order && {
          sortOrder: oldData.sort_order,
        }),
    };

    const after: Prisma.InputJsonObject = {
      ...(dto.name !== undefined &&
        dto.name !== oldData.name && {
          name: dto.name,
        }),

      ...(dto.sort_order !== undefined &&
        dto.sort_order !== oldData.sort_order && {
          sortOrder: dto.sort_order,
        }),
    };

    if (dto.name !== undefined && dto.name !== oldData.name) {
      changedFields.push('name');
    }

    if (dto.sort_order !== undefined && dto.sort_order !== oldData.sort_order) {
      changedFields.push('sortOrder');
    }

    if (changedFields.length === 0) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.sort_order !== undefined && {
          sort_order: dto.sort_order,
        }),
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_CATEGORY,
      entityType: 'Category',
      entityId: categoryId,
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
    const category = await this.prisma.category.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const result = await this.prisma.category.update({
      where: {
        id: id,
      },
      data: {
        is_active: !category.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: result.is_active
        ? AuditAction.ACTIVE_CATEGORY
        : AuditAction.DEACTIVATE_CATEGORY,
      entityType: 'Category',
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

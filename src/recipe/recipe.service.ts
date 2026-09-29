import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction } from '../generated/prisma/enums.js';
import { CreateRecipeDTO } from './dto/create-recipe.dto.js';
import { UpdateRecipeDTO } from './dto/update-recipe.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { GetByProductDTO } from './dto/get-by-product.dto.js';

const ingredientSelect = {
  id: true,
  name: true,
  unit: true,
};

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByProduct(dto: GetByProductDTO) {
    return await this.prisma.recipe.findMany({
      where: {
        product_id: dto.productId,
      },
      include: {
        ingredient: { select: ingredientSelect },
      },
      orderBy: {
        create_at: 'asc',
      },
    });
  }

  async getById(dto: GetByIdDTO) {
    return await this.prisma.recipe.findUniqueOrThrow({
      where: {
        id: dto.id,
      },
      include: {
        ingredient: { select: ingredientSelect },
      },
    });
  }

  async create(
    dto: CreateRecipeDTO,
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

    await this.prisma.ingredient.findUniqueOrThrow({
      where: {
        id: dto.ingredient_id,
        is_active: true,
      },
    });

    const result = await this.prisma.recipe.create({
      data: {
        product_id: dto.product_id,
        ingredient_id: dto.ingredient_id,
        quantity_per_unit: dto.quantity_per_unit,
      },
      include: {
        ingredient: { select: ingredientSelect },
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_RECIPE,
      entityType: 'Recipe',
      entityId: result.id,
      metadata: {
        createData: {
          product_id: result.product_id,
          ingredient_id: result.ingredient_id,
          quantity_per_unit: result.quantity_per_unit,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async update(
    dto: UpdateRecipeDTO,
    recipeId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.recipe.findUniqueOrThrow({
      where: {
        id: recipeId,
      },
    });

    if (dto.quantity_per_unit === oldData.quantity_per_unit) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.recipe.update({
      where: {
        id: recipeId,
      },
      data: {
        quantity_per_unit: dto.quantity_per_unit,
      },
      include: {
        ingredient: { select: ingredientSelect },
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_RECIPE,
      entityType: 'Recipe',
      entityId: recipeId,
      metadata: {
        changedFields: ['quantity_per_unit'],
        before: {
          quantity_per_unit: oldData.quantity_per_unit,
        },
        after: {
          quantity_per_unit: dto.quantity_per_unit,
        },
      },
      ipAddress: ip,
      userAgent,
    });

    return newData;
  }

  async delete(
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const recipe = await this.prisma.recipe.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const result = await this.prisma.recipe.delete({
      where: {
        id: recipe.id,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.DELETE_RECIPE,
      entityType: 'Recipe',
      entityId: id,
      metadata: {
        deletedData: {
          product_id: result.product_id,
          ingredient_id: result.ingredient_id,
          quantity_per_unit: result.quantity_per_unit,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }
}

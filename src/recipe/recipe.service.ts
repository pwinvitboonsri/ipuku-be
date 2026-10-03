import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction } from '../generated/prisma/enums.js';
import { CreateRecipeDTO } from './dto/create-recipe.dto.js';
import { UpdateRecipeDTO } from './dto/update-recipe.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { GetByProductDTO } from './dto/get-by-product.dto.js';
import { CreateRecipeModifierDTO } from './dto/create-recipe-modifier.dto.js';
import { UpdateRecipeModifierDTO } from './dto/update-recipe-modifier.dto.js';

const ingredientSelect = {
  id: true,
  name: true,
  unit: true,
};

const modifierInclude = {
  ingredient: { select: ingredientSelect },
  modifier_option: { select: { id: true, name: true, group_id: true } },
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

  // ── Product x option recipe lines ─────────────────────────────

  async getModifiersByProduct(dto: GetByProductDTO) {
    return await this.prisma.recipeModifier.findMany({
      where: {
        product_id: dto.productId,
      },
      include: modifierInclude,
      orderBy: {
        create_at: 'asc',
      },
    });
  }

  async createModifier(
    dto: CreateRecipeModifierDTO,
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

    const option = await this.prisma.modifierOption.findUniqueOrThrow({
      where: {
        id: dto.modifier_option_id,
      },
    });

    // the option must be sellable on this product, otherwise the rule is dead weight
    const attached = await this.prisma.productModifierGroup.findUnique({
      where: {
        product_id_modifier_group_id: {
          product_id: dto.product_id,
          modifier_group_id: option.group_id,
        },
      },
    });

    if (!attached) {
      throw new BadRequestException(
        `Option "${option.name}" is not available on this product — attach its group first`,
      );
    }

    const result = await this.prisma.recipeModifier.create({
      data: {
        product_id: dto.product_id,
        modifier_option_id: dto.modifier_option_id,
        ingredient_id: dto.ingredient_id,
        quantity_delta: dto.quantity_delta,
      },
      include: modifierInclude,
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_RECIPE_MODIFIER,
      entityType: 'RecipeModifier',
      entityId: result.id,
      metadata: {
        createData: {
          product_id: result.product_id,
          modifier_option_id: result.modifier_option_id,
          ingredient_id: result.ingredient_id,
          quantity_delta: result.quantity_delta,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }

  async updateModifier(
    dto: UpdateRecipeModifierDTO,
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldData = await this.prisma.recipeModifier.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    if (dto.quantity_delta === oldData.quantity_delta) {
      throw new BadRequestException('No changes detected');
    }

    const newData = await this.prisma.recipeModifier.update({
      where: {
        id: id,
      },
      data: {
        quantity_delta: dto.quantity_delta,
      },
      include: modifierInclude,
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_RECIPE_MODIFIER,
      entityType: 'RecipeModifier',
      entityId: id,
      metadata: {
        changedFields: ['quantity_delta'],
        before: { quantity_delta: oldData.quantity_delta },
        after: { quantity_delta: dto.quantity_delta },
      },
      ipAddress: ip,
      userAgent,
    });

    return newData;
  }

  async deleteModifier(
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const line = await this.prisma.recipeModifier.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const result = await this.prisma.recipeModifier.delete({
      where: {
        id: line.id,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.DELETE_RECIPE_MODIFIER,
      entityType: 'RecipeModifier',
      entityId: id,
      metadata: {
        deletedData: {
          product_id: result.product_id,
          modifier_option_id: result.modifier_option_id,
          ingredient_id: result.ingredient_id,
          quantity_delta: result.quantity_delta,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecipeService } from './recipe.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateRecipeDTO } from './dto/create-recipe.dto.js';
import { UpdateRecipeDTO } from './dto/update-recipe.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { GetByProductDTO } from './dto/get-by-product.dto.js';
import { RecipeResEntity } from './entity/recipe-res.entity.js';
import { RecipeListEntity } from './entity/recipe-list.entity.js';
import { CreateRecipeModifierDTO } from './dto/create-recipe-modifier.dto.js';
import { UpdateRecipeModifierDTO } from './dto/update-recipe-modifier.dto.js';
import { RecipeModifierResEntity } from './entity/recipe-modifier-res.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recipe')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get('product/:productId')
  async getByProduct(@Param() dto: GetByProductDTO) {
    const [result, modifiers] = await Promise.all([
      this.recipeService.getByProduct(dto),
      this.recipeService.getModifiersByProduct(dto),
    ]);

    return new RecipeListEntity({
      success: true,
      data: result,
      modifiers: modifiers,
      meta: {
        total: result.length,
      },
    });
  }

  // ── Product x option recipe lines (declared before the ':id' routes) ──

  @Roles(Role.OWNER)
  @Post('modifier/create')
  async createModifier(@Body() dto: CreateRecipeModifierDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.createModifier(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeModifierResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('modifier/:id/update')
  async updateModifier(
    @Body() dto: UpdateRecipeModifierDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.updateModifier(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeModifierResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('modifier/:id/delete')
  async deleteModifier(@Param('id') id: string, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.deleteModifier(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeModifierResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get(':id')
  async getById(@Param() dto: GetByIdDTO) {
    const result = await this.recipeService.getById(dto);

    return new RecipeResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('create')
  async create(@Body() dto: CreateRecipeDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update')
  async update(
    @Body() dto: UpdateRecipeDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.update(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/delete')
  async delete(@Param('id') id: string, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.recipeService.delete(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new RecipeResEntity({
      success: true,
      data: result,
    });
  }
}

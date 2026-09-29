import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IngredientService } from './ingredient.service.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  canSeeInactive,
  IncludeInactiveDTO,
} from '../common/dto/include-inactive.dto.js';
import { CreateIngredientDTO } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDTO } from './dto/update-ingredient.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { IngredientResEntity } from './entity/ingredient-res.entity.js';
import { IngredientListEntity } from './entity/ingredient-list.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ingredient')
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get()
  async get(@Query() query: IncludeInactiveDTO, @Req() req: any) {
    const result = await this.ingredientService.getList(
      canSeeInactive(query, req.user),
    );

    return new IngredientListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get('low-stock')
  async getLowStock() {
    const result = await this.ingredientService.getLowStock();

    return new IngredientListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get(':id')
  async getById(
    @Param() dto: GetByIdDTO,
    @Query() query: IncludeInactiveDTO,
    @Req() req: any,
  ) {
    const result = await this.ingredientService.getById(
      dto,
      canSeeInactive(query, req.user),
    );

    return new IngredientResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('create')
  async create(@Body() dto: CreateIngredientDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.ingredientService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new IngredientResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update')
  async update(
    @Body() dto: UpdateIngredientDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.ingredientService.update(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new IngredientResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update-status')
  async updateStatus(@Param('id') id: string, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.ingredientService.updateStatus(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new IngredientResEntity({
      success: true,
      data: result,
    });
  }
}

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
import { CategoryService } from './category.service.js';
import { CreateDTO } from './dto/create.dto.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  canSeeInactive,
  IncludeInactiveDTO,
} from '../common/dto/include-inactive.dto.js';
import { CategoryListEntity } from './entity/category_list.entity.js';
import { CategoryResEntity } from './entity/category_res.entity.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import { UpdateCategoryDTO } from './dto/update.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.STAFF)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async get(@Query() query: IncludeInactiveDTO, @Req() req: any) {
    const result = await this.categoryService.get(
      canSeeInactive(query, req.user),
    );

    return new CategoryListEntity({
      success: true,
      data: result,
      meta: {
        total: result.length,
      },
    });
  }

  @Get(':id')
  async getById(
    @Param() dto: GetByIdDTO,
    @Query() query: IncludeInactiveDTO,
    @Req() req: any,
  ) {
    const result = await this.categoryService.getById(
      dto,
      canSeeInactive(query, req.user),
    );

    return new CategoryResEntity({
      success: true,
      data: result,
    });
  }

  @Post('create')
  async create(@Body() dto: CreateDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.categoryService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new CategoryResEntity({
      success: true,
      data: result,
    });
  }

  @Post(':id/update')
  async update(
    @Body() dto: UpdateCategoryDTO,
    @Param('id') categoryId: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.categoryService.update(
      dto,
      categoryId,
      actorStaffId,
      ip,
      userAgent,
    );

    return new CategoryResEntity({
      success: true,
      data: result,
    });
  }

  @Post(':id/update-status')
  async updateStatus(@Param('id') id: string, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.categoryService.updateStatus(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new CategoryResEntity({ success: true, data: result });
  }
}

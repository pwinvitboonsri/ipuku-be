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
import { ModifierGroupService } from '../service/modifier-group.service.js';
import { JwtAuthGuard } from '../../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/guard/roles.guard.js';
import { Roles } from '../../common/auth/decorator/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  canSeeInactive,
  IncludeInactiveDTO,
} from '../../common/dto/include-inactive.dto.js';
import { CreateModifierGroupDTO } from '../dto/create-modifier-group.dto.js';
import { UpdateModifierGroupDTO } from '../dto/update-modifier-group.dto.js';
import { GetByIdDTO } from '../dto/get-by-id.dto.js';
import { ModifierGroupResEntity } from '../entity/modifier-group-res.entity.js';
import { ModifierGroupListEntity } from '../entity/modifier-group-list.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('modifier-group')
export class ModifierGroupController {
  constructor(private readonly modifierGroupService: ModifierGroupService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get()
  async get(@Query() query: IncludeInactiveDTO, @Req() req: any) {
    const result = await this.modifierGroupService.getList(
      canSeeInactive(query, req.user),
    );

    return new ModifierGroupListEntity({
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
    const result = await this.modifierGroupService.getById(
      dto,
      canSeeInactive(query, req.user),
    );

    return new ModifierGroupResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post('create')
  async create(@Body() dto: CreateModifierGroupDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.modifierGroupService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierGroupResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update')
  async update(
    @Body() dto: UpdateModifierGroupDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.modifierGroupService.update(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierGroupResEntity({
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

    const result = await this.modifierGroupService.updateStatus(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierGroupResEntity({
      success: true,
      data: result,
    });
  }
}

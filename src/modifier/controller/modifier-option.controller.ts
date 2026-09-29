import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ModifierOptionService } from '../service/modifier-option.service.js';
import { JwtAuthGuard } from '../../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../../common/auth/guard/roles.guard.js';
import { Roles } from '../../common/auth/decorator/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import { CreateModifierOptionDTO } from '../dto/create-modifier-option.dto.js';
import { UpdateModifierOptionDTO } from '../dto/update-modifier-option.dto.js';
import { ModifierOptionResEntity } from '../entity/modifier-option-res.entity.js';

// options are read through their group (GET /modifier-group)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('modifier-option')
export class ModifierOptionController {
  constructor(private readonly modifierOptionService: ModifierOptionService) {}

  @Roles(Role.OWNER)
  @Post('create')
  async create(@Body() dto: CreateModifierOptionDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.modifierOptionService.create(
      dto,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierOptionResEntity({
      success: true,
      data: result,
    });
  }

  @Roles(Role.OWNER)
  @Post(':id/update')
  async update(
    @Body() dto: UpdateModifierOptionDTO,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actorStaffId = req.user.userId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.modifierOptionService.update(
      dto,
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierOptionResEntity({
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

    const result = await this.modifierOptionService.updateStatus(
      id,
      actorStaffId,
      ip,
      userAgent,
    );

    return new ModifierOptionResEntity({
      success: true,
      data: result,
    });
  }
}

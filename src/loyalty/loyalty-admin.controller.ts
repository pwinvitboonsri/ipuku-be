import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { LoyaltyAdminService } from './loyalty-admin.service.js';
import { UpdateProgramDTO } from './dto/update-program.dto.js';
import { CreateRewardDTO, ListMembersDTO, UpdateRewardDTO, UpdateRewardStatusDTO } from './dto/reward.dto.js';
import { ListActivityDTO } from './dto/activity.dto.js';

// Back office → Loyalty
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('loyalty/admin')
export class LoyaltyAdminController {
  constructor(private readonly admin: LoyaltyAdminService) {}

  private actor(req: any) {
    return { staffId: req.user.userId as string, ip: req.ip as string, userAgent: req.headers['user-agent'] as string };
  }

  @Get('program')
  async program() {
    return { success: true, data: await this.admin.getProgram() };
  }

  @Post('program/update')
  @HttpCode(HttpStatus.OK)
  async updateProgram(@Body() dto: UpdateProgramDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updateProgram(dto, this.actor(req)) };
  }

  @Get('rewards')
  async rewards() {
    const data = await this.admin.listRewards();
    return { success: true, data, meta: { total: data.length } };
  }

  @Post('rewards/create')
  async createReward(@Body() dto: CreateRewardDTO, @Req() req: any) {
    return { success: true, data: await this.admin.createReward(dto, this.actor(req)) };
  }

  @Post('rewards/:id/update')
  @HttpCode(HttpStatus.OK)
  async updateReward(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRewardDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updateReward(id, dto, this.actor(req)) };
  }

  @Post('rewards/:id/update-status')
  @HttpCode(HttpStatus.OK)
  async updateRewardStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRewardStatusDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updateRewardStatus(id, dto.is_active, this.actor(req)) };
  }

  @Get('members')
  async members(@Query() dto: ListMembersDTO) {
    const { total, members } = await this.admin.listMembers(dto);
    return { success: true, data: members, meta: { total } };
  }

  @Get('activity')
  async activity(@Query() dto: ListActivityDTO) {
    const data = await this.admin.listActivity(dto);
    return { success: true, data, meta: { total: data.length } };
  }
}

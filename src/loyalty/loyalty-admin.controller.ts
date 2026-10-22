import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { LoyaltyAdminService } from './loyalty-admin.service.js';
import { UpdateProgramDTO } from './dto/update-program.dto.js';
import { CreateRewardDTO, ListMembersDTO, UpdateRewardDTO, UpdateRewardStatusDTO } from './dto/reward.dto.js';
import { ListActivityDTO } from './dto/activity.dto.js';
import { EarnRuleDTO, EarnRuleStatusDTO } from './dto/earn-rule.dto.js';
import { UpdatePerkDTO } from './dto/perk.dto.js';
import { AdjustPointsDTO, MemberBirthdayDTO } from './dto/member-admin.dto.js';
import { PerkKind } from '../generated/prisma/enums.js';

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

  @Get('earn-rules')
  async earnRules() {
    const data = await this.admin.listEarnRules();
    return { success: true, data, meta: { total: data.length } };
  }

  @Post('earn-rules/create')
  async createEarnRule(@Body() dto: EarnRuleDTO, @Req() req: any) {
    return { success: true, data: await this.admin.createEarnRule(dto, this.actor(req)) };
  }

  @Post('earn-rules/:id/update')
  @HttpCode(HttpStatus.OK)
  async updateEarnRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EarnRuleDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updateEarnRule(id, dto, this.actor(req)) };
  }

  @Post('earn-rules/:id/update-status')
  @HttpCode(HttpStatus.OK)
  async updateEarnRuleStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EarnRuleStatusDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updateEarnRuleStatus(id, dto.is_active, this.actor(req)) };
  }

  @Get('perks')
  async perks() {
    return { success: true, data: await this.admin.listPerks() };
  }

  @Post('perks/:kind/update')
  @HttpCode(HttpStatus.OK)
  async updatePerk(@Param('kind', new ParseEnumPipe(PerkKind)) kind: PerkKind, @Body() dto: UpdatePerkDTO, @Req() req: any) {
    return { success: true, data: await this.admin.updatePerk(kind, dto, this.actor(req)) };
  }

  @Post('members/:id/adjust')
  @HttpCode(HttpStatus.OK)
  async adjust(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustPointsDTO, @Req() req: any) {
    return { success: true, data: await this.admin.adjustPoints(id, dto, this.actor(req)) };
  }

  @Post('members/:id/birthday')
  @HttpCode(HttpStatus.OK)
  async birthday(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MemberBirthdayDTO, @Req() req: any) {
    return { success: true, data: await this.admin.setBirthday(id, dto, this.actor(req)) };
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

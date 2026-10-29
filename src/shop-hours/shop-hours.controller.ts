import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { ShopHoursService } from './shop-hours.service.js';
import { ShopSettingsDTO, SpecialDayDTO, WeeklyHoursDTO } from './dto/shop-hours.dto.js';

// Back office → Opening hours (owner); today's plan for the counter (everyone)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shop-hours')
export class ShopHoursController {
  constructor(private readonly hours: ShopHoursService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get('today')
  async today() {
    return { success: true, data: await this.hours.today() };
  }

  @Roles(Role.OWNER)
  @Get()
  async overview() {
    return { success: true, data: await this.hours.overview() };
  }

  @Roles(Role.OWNER)
  @Post('settings/update')
  @HttpCode(HttpStatus.OK)
  async settings(@Body() dto: ShopSettingsDTO, @Req() req: any) {
    return { success: true, data: await this.hours.updateSettings(dto, req.user.userId) };
  }

  @Roles(Role.OWNER)
  @Post('weekly/create')
  @HttpCode(HttpStatus.OK)
  async saveWeekly(@Body() dto: WeeklyHoursDTO, @Req() req: any) {
    return { success: true, data: await this.hours.saveWeekly(dto, req.user.userId) };
  }

  @Roles(Role.OWNER)
  @Post('weekly/:id/delete')
  @HttpCode(HttpStatus.OK)
  async deleteWeekly(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.hours.deleteWeekly(id) };
  }

  @Roles(Role.OWNER)
  @Post('special/create')
  @HttpCode(HttpStatus.OK)
  async createSpecial(@Body() dto: SpecialDayDTO, @Req() req: any) {
    return { success: true, data: await this.hours.createSpecial(dto, req.user.userId) };
  }

  @Roles(Role.OWNER)
  @Post('special/:id/update')
  @HttpCode(HttpStatus.OK)
  async updateSpecial(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SpecialDayDTO, @Req() req: any) {
    return { success: true, data: await this.hours.updateSpecial(id, dto, req.user.userId) };
  }

  @Roles(Role.OWNER)
  @Post('special/:id/delete')
  @HttpCode(HttpStatus.OK)
  async deleteSpecial(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.hours.deleteSpecial(id) };
  }
}

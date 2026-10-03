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
import { CashSessionService } from './cash-session.service.js';
import { SessionResEntity } from './entity/session-res.entity.js';
import { OpenSessionDTO } from './dto/create-session.dto.js';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CloseSessionDTO } from './dto/close-session.dto.js';
import { GetSessionById } from './dto/get-session-by-id.dto.js';
import { GetSessionList } from './dto/get-session-list.dto.js';
import { SessionListEntity } from './entity/session-list.entity.js';
import { ShiftReportResEntity } from './entity/shift-report-res.entity.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash-session')
export class CashSessionController {
  constructor(private readonly cashSessionService: CashSessionService) {}

  @Roles(Role.OWNER, Role.STAFF)
  @Get('current')
  async getCurrentSession() {
    const session = await this.cashSessionService.currentSession();

    return new SessionResEntity({
      success: true,
      data: session,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Post('open')
  async openSession(@Body() dto: OpenSessionDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const session = await this.cashSessionService.openSession(
      dto,
      actorStaffId,
    );

    return new SessionResEntity({
      success: true,
      data: session,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Post('close')
  async closeSession(@Body() dto: CloseSessionDTO, @Req() req: any) {
    const actorStaffId = req.user.userId;
    const session = await this.cashSessionService.closeSession(
      dto,
      actorStaffId,
    );

    return new SessionResEntity({
      success: true,
      data: session,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get(':id/report')
  async getReport(@Param() dto: GetSessionById) {
    const report = await this.cashSessionService.getReport(dto);

    return new ShiftReportResEntity({
      success: true,
      data: report,
    });
  }

  @Roles(Role.OWNER, Role.STAFF)
  @Get(':id')
  async getSessionById(@Param() dto: GetSessionById) {
    const session = await this.cashSessionService.getSessionById(dto);

    return new SessionResEntity({
      success: true,
      data: session,
    });
  }

  @Roles(Role.OWNER)
  @Get()
  async getSessionList(@Query() dto: GetSessionList) {
    const sessions = await this.cashSessionService.getSessionList(dto);

    return new SessionListEntity({
      success: true,
      data: sessions,
      meta: {
        total: sessions.length,
        filter: {
          before: dto.before,
          after: dto.after,
          is_opening: dto.is_opening,
          opened_by_staff_id: dto.opened_by_staff_id,
          close_by_staff_id: dto.close_by_staff_id,
        },
      },
    });
  }
}

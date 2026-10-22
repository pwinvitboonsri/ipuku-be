import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/guard/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/guard/roles.guard.js';
import { Roles } from '../common/auth/decorator/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { ReportService } from './report.service.js';
import { DashboardQueryDTO } from './dto/dashboard-query.dto.js';

// Back office → Dashboard (owner only)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('report')
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get('dashboard')
  async dashboard(@Query() dto: DashboardQueryDTO) {
    return { success: true, data: await this.report.dashboard(dto) };
  }
}

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { ShopHoursModule } from '../shop-hours/shop-hours.module.js';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule, ShopHoursModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}

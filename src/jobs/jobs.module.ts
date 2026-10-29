import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';
import { ShopHoursModule } from '../shop-hours/shop-hours.module.js';
import { JobsSecretGuard, LoyaltyJobsController } from '../loyalty/loyalty-jobs.controller.js';

// Scheduled work called by the keep-warm worker (POST /loyalty/jobs/daily): loyalty perks and holds, and
// shifts left open past closing time. Its own module because it needs both loyalty and shop hours.
@Module({
  imports: [LoyaltyModule, ShopHoursModule],
  controllers: [LoyaltyJobsController],
  providers: [JobsSecretGuard],
})
export class JobsModule {}

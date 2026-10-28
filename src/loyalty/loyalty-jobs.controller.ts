import { CanActivate, Controller, ExecutionContext, HttpCode, HttpStatus, Injectable, Post, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { LoyaltyPerksService } from './loyalty-perks.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';

// Only the scheduler (ops/keep-warm cron worker) knows JOBS_SECRET; off until it's set
@Injectable()
export class JobsSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('JOBS_SECRET');
    if (!secret) throw new ServiceUnavailableException('Jobs are off (JOBS_SECRET not set)');
    const header = context.switchToHttp().getRequest().headers['x-jobs-secret'];
    const given = Buffer.from(typeof header === 'string' ? header : '');
    const expected = Buffer.from(secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return true;
  }
}

@SkipThrottle()
@UseGuards(JobsSecretGuard)
@Controller('loyalty/jobs')
export class LoyaltyJobsController {
  constructor(
    private readonly perks: LoyaltyPerksService,
    private readonly orders: LoyaltyOrderService,
  ) {}

  // Once a day (safe to run more often: every grant is once per member per period)
  @Post('daily')
  @HttpCode(HttpStatus.OK)
  async daily() {
    // rewards a counter held and never used go back to their members (also done lazily on every read)
    await this.orders.releaseLapsed();
    const birthdays = await this.perks.runBirthdays();
    return { success: true, data: { birthdays } };
  }
}

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module.js';
import { LineModule } from '../line/line.module.js';
import { LoyaltyLedgerService } from './loyalty-ledger.service.js';
import { LoyaltyProgramService } from './loyalty-program.service.js';
import { LoyaltyOrderService } from './loyalty-order.service.js';
import { LoyaltyMemberService } from './loyalty-member.service.js';
import { LoyaltyAdminService } from './loyalty-admin.service.js';
import { LoyaltyMemberController } from './loyalty-member.controller.js';
import { LoyaltyPosController } from './loyalty-pos.controller.js';
import { LoyaltyAdminController } from './loyalty-admin.controller.js';
import { LineUserGuard } from './guard/line-user.guard.js';

// LINE points & rewards (see the loyalty design). The order module calls LoyaltyOrderService
// inside its pay/refund/void transactions.
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), CommonModule, LineModule],
  controllers: [LoyaltyMemberController, LoyaltyPosController, LoyaltyAdminController],
  providers: [LoyaltyLedgerService, LoyaltyProgramService, LoyaltyOrderService, LoyaltyMemberService, LoyaltyAdminService, LineUserGuard],
  exports: [LoyaltyOrderService],
})
export class LoyaltyModule {}

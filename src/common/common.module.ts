import { Module } from "@nestjs/common";
import { AuditService } from "./audit/audit.service.js";

@Module({
  providers: [
    AuditService,
  ],
  exports: [
    AuditService,
  ],
})
export class CommonModule {}
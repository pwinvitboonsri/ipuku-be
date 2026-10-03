import type { ShiftReport } from '../function/build-shift-report.function.js';

export class ShiftReportResEntity {
  success: boolean;
  data: ShiftReport;

  constructor(partial: Partial<ShiftReportResEntity>) {
    Object.assign(this, partial);
  }
}

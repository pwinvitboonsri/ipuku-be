import { BadRequestException } from '@nestjs/common';
import { PaymentType } from '../../generated/prisma/enums.js';

export type TenderInput = {
  method: PaymentType;
  amount_satang: number;
  tender_satang?: number;
  reference?: string;
};

export type TenderRow = {
  method: PaymentType;
  amount_satang: number;
  tender_satang: number | null;
  change_satang: number | null;
  reference: string | null;
};

// Checks a (possibly mixed) payment against the order total and turns it into
// Payment rows. The parts must add up to the total exactly; overpaying is only
// possible as cash change, so there is at most one cash part.
export function validateTenders(
  total: number,
  payments: TenderInput[],
): TenderRow[] {
  const cash = payments.filter((p) => p.method === PaymentType.CASH);
  if (cash.length > 1) {
    throw new BadRequestException('Only one cash part is allowed per payment');
  }

  const sum = payments.reduce((t, p) => t + p.amount_satang, 0);
  if (sum !== total) {
    throw new BadRequestException(
      `Payments total ${sum} does not match order total ${total}`,
    );
  }

  return payments.map((p) => {
    if (p.method !== PaymentType.CASH) {
      return {
        method: p.method,
        amount_satang: p.amount_satang,
        tender_satang: null,
        change_satang: null,
        reference: p.reference || null,
      };
    }
    const tender = p.tender_satang ?? 0;
    if (tender < p.amount_satang) {
      throw new BadRequestException(
        `Tender ${tender} is less than cash amount ${p.amount_satang}`,
      );
    }
    return {
      method: p.method,
      amount_satang: p.amount_satang,
      tender_satang: tender,
      change_satang: tender - p.amount_satang,
      reference: null,
    };
  });
}

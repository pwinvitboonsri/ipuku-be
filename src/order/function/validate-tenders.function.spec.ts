import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateTenders } from './validate-tenders.function.js';

// Money in satang (฿200.00 -> 20000)
describe('validateTenders', () => {
  it('takes a single cash payment and works out change', () => {
    expect(
      validateTenders(15000, [{ method: 'CASH', amount_satang: 15000, tender_satang: 20000 }]),
    ).toEqual([{ method: 'CASH', amount_satang: 15000, tender_satang: 20000, change_satang: 5000, reference: null }]);
  });

  it('takes PromptPay + the rest in cash', () => {
    expect(
      validateTenders(20000, [
        { method: 'PROMPTPAY', amount_satang: 12000, reference: 'KB-1' },
        { method: 'CASH', amount_satang: 8000, tender_satang: 10000 },
      ]),
    ).toEqual([
      { method: 'PROMPTPAY', amount_satang: 12000, tender_satang: null, change_satang: null, reference: 'KB-1' },
      { method: 'CASH', amount_satang: 8000, tender_satang: 10000, change_satang: 2000, reference: null },
    ]);
  });

  it('takes two PromptPay transfers', () => {
    const rows = validateTenders(20000, [
      { method: 'PROMPTPAY', amount_satang: 10000 },
      { method: 'PROMPTPAY', amount_satang: 10000, reference: '' },
    ]);
    expect(rows.map((r) => [r.method, r.amount_satang, r.reference])).toEqual([
      ['PROMPTPAY', 10000, null],
      ['PROMPTPAY', 10000, null],
    ]);
  });

  it('rejects parts that do not add up to the total', () => {
    expect(() =>
      validateTenders(20000, [
        { method: 'PROMPTPAY', amount_satang: 12000 },
        { method: 'CASH', amount_satang: 9000, tender_satang: 9000 },
      ]),
    ).toThrow(new BadRequestException('Payments total 21000 does not match order total 20000'));
    expect(() => validateTenders(20000, [{ method: 'PROMPTPAY', amount_satang: 19900 }])).toThrow(BadRequestException);
  });

  it('rejects more than one cash part', () => {
    expect(() =>
      validateTenders(20000, [
        { method: 'CASH', amount_satang: 10000, tender_satang: 10000 },
        { method: 'CASH', amount_satang: 10000, tender_satang: 10000 },
      ]),
    ).toThrow('Only one cash part is allowed per payment');
  });

  it('rejects cash tendered below its part', () => {
    expect(() =>
      validateTenders(20000, [
        { method: 'PROMPTPAY', amount_satang: 12000 },
        { method: 'CASH', amount_satang: 8000, tender_satang: 5000 },
      ]),
    ).toThrow('Tender 5000 is less than cash amount 8000');
  });
});

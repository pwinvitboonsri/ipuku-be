import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { mapGrabOrder, summarizeItems } from './map-grab-order.function.js';
import { parseGrabBody } from './parse-grab-body.function.js';
import { GrabSubmitOrderDTO } from '../dto/grab-submit-order.dto.js';
import sample from '../fixtures/submit-order.sample.json' with { type: 'json' };

describe('parseGrabBody', () => {
  it('accepts the sample webhook and strips fields we do not use', () => {
    const order = parseGrabBody(GrabSubmitOrderDTO, sample);

    expect(order.orderID).toBe(sample.orderID);
    expect(order.items).toHaveLength(2);
    expect('receiver' in order).toBe(false);
  });

  it('rejects a body without items', () => {
    expect(() =>
      parseGrabBody(GrabSubmitOrderDTO, { ...sample, items: [] }),
    ).toThrow(BadRequestException);
  });
});

describe('mapGrabOrder', () => {
  it('maps Grab items to our product and option ids', () => {
    const order = parseGrabBody(GrabSubmitOrderDTO, sample);

    expect(mapGrabOrder(order)).toEqual([
      {
        product_id: sample.items[0].id,
        quantity: 2,
        modifier_option_ids: [sample.items[0].modifiers[0].id],
      },
      { product_id: sample.items[1].id, quantity: 1, modifier_option_ids: [] },
    ]);
  });

  it('rejects a modifier ordered more than once on one line', () => {
    const order = parseGrabBody(GrabSubmitOrderDTO, {
      ...sample,
      items: [{ id: 'p1', quantity: 1, modifiers: [{ id: 'o1', quantity: 2 }] }],
    });

    expect(() => mapGrabOrder(order)).toThrow(BadRequestException);
  });
});

describe('summarizeItems', () => {
  it('lists quantity and name', () => {
    expect(
      summarizeItems([
        { product_name_snapshot: 'Iced latte', quantity: 2 },
        { product_name_snapshot: 'Green tea', quantity: 1 },
      ]),
    ).toBe('2× Iced latte, 1× Green tea');
  });
});

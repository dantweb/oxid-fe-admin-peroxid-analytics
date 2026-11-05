import { describe, expect, it } from 'vitest';
import { generateDemoData, interpolate, PAYMENT_METHODS } from '../../src/ecw/demoData';
import { createRandom } from '../../src/ecw/random';

const TODAY = new Date(2026, 10, 4, 15, 30); // 2026-11-04, local time

describe('interpolate (the PHP generator’s linearInterpolate)', () => {
  const anchors = [
    [0, 2],
    [10, 42],
    [20, 17],
  ] as const;

  it('is flat beyond the anchors and linear between them', () => {
    expect(interpolate(-5, anchors)).toBe(2);
    expect(interpolate(25, anchors)).toBe(17);
    expect(interpolate(5, anchors)).toBe(22);
    expect(interpolate(15, anchors)).toBe(29.5);
  });
});

describe('createRandom', () => {
  it('is deterministic for a seed and stays in range', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    const values = Array.from({ length: 20 }, () => a.int(1, 10));

    expect(values).toEqual(Array.from({ length: 20 }, () => b.int(1, 10)));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...values)).toBeLessThanOrEqual(10);
    expect(createRandom(1).next()).not.toBe(createRandom(2).next());
  });
});

describe('generateDemoData', () => {
  const data = generateDemoData({ today: TODAY, days: 30, seed: 1 });

  it('is the same for the same seed and differs for another', () => {
    expect(
      generateDemoData({ today: TODAY, days: 30, seed: 1 }).orders.column('order_number'),
    ).toEqual(data.orders.column('order_number'));
    expect(generateDemoData({ today: TODAY, days: 30, seed: 2 }).orders.count).not.toBe(
      data.orders.count,
    );
  });

  it('covers every day of the span with at least four orders, each with the ecwatch fields', () => {
    const days = new Set(data.orders.column<Date>('timestamp').map((t) => t.toDateString()));
    expect(days.size).toBe(30);
    expect(data.orders.count).toBeGreaterThanOrEqual(120);
    for (const row of data.orders.rows) {
      expect(row.names()).toEqual([
        'order_number',
        'order_brutto',
        'order_items_count',
        'order_payment_method_id',
        'timestamp',
      ]);
      expect(row.get<number>('order_brutto')).toBeGreaterThan(0);
      expect(row.get<number>('order_items_count')).toBeGreaterThanOrEqual(1);
      expect(PAYMENT_METHODS).toContain(row.get('order_payment_method_id'));
    }
    const numbers = data.orders.column<string>('order_number');
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers[0]).toBe('ORD-00001');
  });

  it('customers join every day, with ids, names and an address nobody owns', () => {
    const joined = new Set(data.customers.column<Date>('joined_date').map((t) => t.toDateString()));
    expect(joined.size).toBe(30);
    expect(data.customers.count).toBeLessThan(data.orders.count);
    for (const row of data.customers.rows) {
      expect(row.get<string>('email')).toMatch(/^customer-\d+@example\.invalid$/);
      expect(row.get<string>('first_name')).not.toBe('');
    }
    expect(data.customers.column<number>('customer_id')[0]).toBe(1);
  });

  it('the latest order is on `today`, the earliest `days - 1` days before', () => {
    const times = data.orders.column<Date>('timestamp').map((t) => t.getTime());
    expect(new Date(Math.max(...times)).toDateString()).toBe(TODAY.toDateString());
    expect(new Date(Math.min(...times)).toDateString()).toBe(new Date(2026, 9, 6).toDateString());
  });
});

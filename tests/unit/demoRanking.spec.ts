import { describe, expect, it } from 'vitest';
import { bucketKeys, inRange, lastDays } from '../../src/series/buckets';
import { generateDemoData } from '../../src/ecw/demoData';
import { DEMO_PRODUCTS, demoRankingEntries, demoTopShare } from '../../src/ecw/demoRanking';
import type { RankMeasure } from '../../src/series/ranking';

const TODAY = new Date(2026, 10, 4, 15, 30);
const data = generateDemoData({ today: TODAY, days: 90, seed: 1 });
const range = lastDays(TODAY, 30);

const orderRows = (period: { from: Date; to: Date }) =>
  data.orders.rows.filter((row) => inRange(row.get<Date>('timestamp'), period));
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const valuesOf = (measure: RankMeasure, subject: 'products' | 'categories' = 'products') =>
  demoRankingEntries(data, subject, range, measure).map((entry) => entry.value);

describe('demoRankingEntries', () => {
  it('is deterministic for a period and differs for another', () => {
    const again = demoRankingEntries(data, 'products', range, 'sales');

    expect(again).toEqual(demoRankingEntries(data, 'products', range, 'sales'));
    expect(again).not.toEqual(demoRankingEntries(data, 'products', lastDays(TODAY, 7), 'sales'));
  });

  it('sums to what the demo orders of the period are worth, in cents', () => {
    const expected = sum(orderRows(range).map((row) => row.get<number>('order_brutto')));

    expect(sum(valuesOf('sales'))).toBeCloseTo(expected, 2);
    expect(expected).toBeGreaterThan(0);
  });

  it('counts the units of the demo orders as whole numbers', () => {
    const expected = sum(orderRows(range).map((row) => row.get<number>('order_items_count')));

    expect(sum(valuesOf('units'))).toBe(expected);
    expect(valuesOf('units').every(Number.isInteger)).toBe(true);
  });

  it('no product is in more orders than there were', () => {
    const count = orderRows(range).length;

    expect(Math.max(...valuesOf('orders'))).toBeLessThanOrEqual(count);
    expect(valuesOf('orders').every(Number.isInteger)).toBe(true);
  });

  it('knows each product once, with a number and a title', () => {
    const ids = DEMO_PRODUCTS.map((product) => product.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(DEMO_PRODUCTS.every((product) => product.title !== '' && product.number !== '')).toBe(
      true,
    );
    expect(
      demoRankingEntries(data, 'products', range, 'sales')
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([...ids].sort());
  });

  it('the categories hold the same whole as the products, and sales without a category are one entry', () => {
    const categories = demoRankingEntries(data, 'categories', range, 'sales');

    expect(sum(categories.map((entry) => entry.value))).toBeCloseTo(sum(valuesOf('sales')), 2);
    expect(categories.filter((entry) => entry.id === null)).toHaveLength(1);
    expect(categories.find((entry) => entry.id === null)).toMatchObject({ number: null });
    expect(categories.length).toBeLessThan(DEMO_PRODUCTS.length);
  });

  it('is empty for a period without orders', () => {
    const before = lastDays(new Date(2020, 0, 10), 7);

    expect(demoRankingEntries(data, 'products', before, 'sales')).toEqual([]);
    expect(demoRankingEntries(data, 'categories', before, 'orders')).toEqual([]);
  });
});

describe('demoTopShare', () => {
  const daily = bucketKeys(range.from, range.to, 'daily');

  it('is one share per bucket of the calendar, in percent, deterministic', () => {
    const shares = demoTopShare(data, range, 'daily', 5, 'sales');

    expect(shares).toHaveLength(daily.length);
    expect(shares).toEqual(demoTopShare(data, range, 'daily', 5, 'sales'));
    expect(Math.min(...shares)).toBeGreaterThan(0);
    expect(Math.max(...shares)).toBeLessThanOrEqual(100);
  });

  it('a larger top holds a larger share, and all products hold 100 percent', () => {
    const five = demoTopShare(data, range, 'daily', 5, 'sales');
    const twenty = demoTopShare(data, range, 'daily', 20, 'sales');

    expect(twenty.every((share, at) => share >= five[at]!)).toBe(true);
    expect(twenty.every((share) => share === 100)).toBe(true); // the demo catalogue has 18 products
  });

  it('weekly folds into the ISO weeks of the range', () => {
    expect(demoTopShare(data, range, 'weekly', 5, 'units')).toHaveLength(
      bucketKeys(range.from, range.to, 'weekly').length,
    );
  });

  it('a bucket without orders is 0, not missing', () => {
    const before = lastDays(new Date(2020, 0, 10), 3);

    expect(demoTopShare(data, before, 'daily', 5, 'sales')).toEqual([0, 0, 0]);
  });
});

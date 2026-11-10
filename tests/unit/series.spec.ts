import { describe, expect, it } from 'vitest';
import { toAnalyticsData } from '../../src/ecw/models';
import {
  bucketKey,
  bucketKeys,
  dayKey,
  inRange,
  lastDays,
  previousRange,
  startOfIsoWeek,
} from '../../src/series/buckets';
import { computeSeries, METRICS, metricById, totals } from '../../src/series/metrics';

const order = (day: string, brutto: number) => ({
  order_number: `ORD-${day}-${brutto}`,
  order_brutto: brutto,
  order_items_count: 1,
  order_payment_method_id: 'stripe',
  timestamp: new Date(`${day}T10:00:00`),
});
const customer = (id: number, day: string) => ({
  customer_id: id,
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: `customer-${id}@example.invalid`,
  joined_date: new Date(`${day}T12:00:00`),
});

describe('buckets', () => {
  it('a day key is the local calendar day; the week key its Monday', () => {
    const wednesday = new Date(2026, 10, 4, 23, 59); // 2026-11-04 is a Wednesday
    expect(dayKey(wednesday)).toBe('2026-11-04');
    expect(dayKey(startOfIsoWeek(wednesday))).toBe('2026-11-02');
    expect(dayKey(startOfIsoWeek(new Date(2026, 10, 1)))).toBe('2026-10-26'); // a Sunday
    expect(bucketKey(wednesday, 'daily')).toBe('2026-11-04');
    expect(bucketKey(wednesday, 'weekly')).toBe('2026-11-02');
  });

  it('the keys of a range cover every bucket, empty ones included', () => {
    const range = lastDays(new Date(2026, 10, 4), 7);
    expect(bucketKeys(range.from, range.to, 'daily')).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(bucketKeys(range.from, range.to, 'weekly')).toEqual(['2026-10-26', '2026-11-02']);
  });

  it('the previous period has the same length and ends the day before', () => {
    const range = lastDays(new Date(2026, 10, 4), 30);
    const before = previousRange(range);
    expect(dayKey(before.to)).toBe('2026-10-05');
    expect(dayKey(before.from)).toBe('2026-09-06');
    expect(inRange(new Date(2026, 9, 5, 23, 0), before)).toBe(true);
    expect(inRange(new Date(2026, 9, 6, 0, 0), before)).toBe(false);
  });
});

describe('computeSeries', () => {
  const data = toAnalyticsData(
    [
      order('2026-11-02', 10),
      order('2026-11-02', 30),
      order('2026-11-04', 5.5),
      order('2026-10-01', 999),
    ],
    [customer(1, '2026-11-02'), customer(2, '2026-11-04'), customer(3, '2026-11-04')],
  );
  const range = lastDays(new Date(2026, 10, 4), 3);

  it('daily: one value per day, sums and counts per bucket, ratios zero-safe', () => {
    const series = computeSeries(data, { ...range, granularity: 'daily' });

    expect(series.keys).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(series.values.orders).toEqual([2, 0, 1]);
    expect(series.values.sales).toEqual([40, 0, 5.5]);
    expect(series.values.customers).toEqual([1, 0, 2]);
    expect(series.values.ordersPerCustomer).toEqual([2, 0, 0.5]);
    expect(series.values.salesPerCustomer).toEqual([40, 0, 2.75]);
    expect(series.values.averageOrder).toEqual([20, 0, 5.5]);
  });

  it('weekly: the three days fall into one ISO week; the October order is outside the range', () => {
    const series = computeSeries(data, { ...range, granularity: 'weekly' });

    expect(series.keys).toEqual(['2026-11-02']);
    expect(series.values.orders).toEqual([3]);
    expect(series.values.sales).toEqual([45.5]);
  });

  it('totals: sums for the absolute metrics, the ratio of the sums for the relative ones', () => {
    const series = computeSeries(data, { ...range, granularity: 'daily' });

    expect(totals(series)).toEqual({
      orders: 3,
      sales: 45.5,
      customers: 3,
      ordersPerCustomer: 1,
      salesPerCustomer: 45.5 / 3,
      averageOrder: 45.5 / 3,
    });
    expect(
      totals({
        keys: [],
        values: {
          orders: [],
          sales: [],
          customers: [],
          ordersPerCustomer: [],
          salesPerCustomer: [],
          averageOrder: [],
        },
      }).ordersPerCustomer,
    ).toBe(0);
  });

  it('the metric catalogue names the three relative metrics and their units', () => {
    expect(METRICS.map((m) => m.id)).toEqual([
      'orders',
      'sales',
      'customers',
      'ordersPerCustomer',
      'salesPerCustomer',
      'averageOrder',
    ]);
    expect(METRICS.filter((m) => m.relative).map((m) => m.id)).toEqual([
      'ordersPerCustomer',
      'salesPerCustomer',
      'averageOrder',
    ]);
    expect(metricById('salesPerCustomer').unit).toBe('currency');
    expect(metricById('averageOrder').unit).toBe('currency');
    expect(metricById('ordersPerCustomer').unit).toBe('ratio');
  });
});

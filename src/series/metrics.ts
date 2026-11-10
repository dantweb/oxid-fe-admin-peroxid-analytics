import type { Matrix } from '../atomizer/model';
import type { AnalyticsData } from '../ecw/models';
import { bucketKey, bucketKeys, inRange, type Granularity } from './buckets';

/**
 * What a curve shows. The two `…PerCustomer` metrics and `averageOrder` (sales per order) are the "relative"
 * view: a ratio per bucket.
 */
export type MetricId =
  'orders' | 'sales' | 'customers' | 'ordersPerCustomer' | 'salesPerCustomer' | 'averageOrder';

export type Unit = 'count' | 'currency' | 'ratio';

export interface MetricDefinition {
  id: MetricId;
  unit: Unit;
  /** a ratio of two absolute metrics */
  relative: boolean;
}

export const METRICS: readonly MetricDefinition[] = [
  { id: 'orders', unit: 'count', relative: false },
  { id: 'sales', unit: 'currency', relative: false },
  { id: 'customers', unit: 'count', relative: false },
  { id: 'ordersPerCustomer', unit: 'ratio', relative: true },
  { id: 'salesPerCustomer', unit: 'currency', relative: true },
  { id: 'averageOrder', unit: 'currency', relative: true },
];

export const metricById = (id: MetricId): MetricDefinition =>
  METRICS.find((metric) => metric.id === id)!;

export interface SeriesQuery {
  from: Date;
  to: Date;
  granularity: Granularity;
}

/** Every metric per bucket, aligned on `keys`. */
export interface Series {
  keys: string[];
  values: Record<MetricId, number[]>;
}

/** Sums `field` of the rows whose `timeField` falls in the bucket; undefined field = count. */
function accumulate(
  matrix: Matrix,
  timeField: string,
  query: SeriesQuery,
  keys: string[],
  field?: string,
): number[] {
  const index = new Map(keys.map((key, at) => [key, at]));
  const totals = new Array<number>(keys.length).fill(0);
  for (const row of matrix.rows) {
    const time = row.get<Date>(timeField);
    if (!inRange(time, query)) {
      continue;
    }
    const at = index.get(bucketKey(time, query.granularity));
    if (at !== undefined) {
      totals[at] = totals[at]! + (field === undefined ? 1 : row.get<number>(field));
    }
  }
  return totals;
}

const ratio = (numerators: number[], denominators: number[]): number[] =>
  numerators.map((n, at) => (denominators[at]! > 0 ? n / denominators[at]! : 0));

export function computeSeries(data: AnalyticsData, query: SeriesQuery): Series {
  const keys = bucketKeys(query.from, query.to, query.granularity);
  const orders = accumulate(data.orders, 'timestamp', query, keys);
  const sales = accumulate(data.orders, 'timestamp', query, keys, 'order_brutto').map(
    (value) => Math.round(value * 100) / 100,
  );
  const customers = accumulate(data.customers, 'joined_date', query, keys);
  return {
    keys,
    values: {
      orders,
      sales,
      customers,
      ordersPerCustomer: ratio(orders, customers),
      salesPerCustomer: ratio(sales, customers),
      averageOrder: ratio(sales, orders),
    },
  };
}

/** The whole-range totals (the stat tiles): sums for the absolute metrics, the ratio of the sums for the relative ones. */
export function totals(series: Series): Record<MetricId, number> {
  const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
  const orders = sum(series.values.orders);
  const sales = sum(series.values.sales);
  const customers = sum(series.values.customers);
  return {
    orders,
    sales,
    customers,
    ordersPerCustomer: customers > 0 ? orders / customers : 0,
    salesPerCustomer: customers > 0 ? sales / customers : 0,
    averageOrder: orders > 0 ? sales / orders : 0,
  };
}

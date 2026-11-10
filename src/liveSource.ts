import type { Granularity } from './series/buckets';
import type { MetricId, Series } from './series/metrics';

/**
 * The shop's numbers, when the OXID module `peroxid_analytics` (dantweb/oxid-fe-admin-peroxid-analytics, folder
 * `source/extensions/oxid-fe-admin-peroxid-analytics`) is active and the admin holds `ADMIN_ANALYTICS_VIEW`: one
 * query, `adminAnalyticsSeries`, answers the buckets of a period already aggregated (no order, no customer, no
 * personal data leaves the shop). Without the module (the field is unknown), without the right or without a
 * session the plugin stays on its demo data (`src/ecw/demoData.ts`) and says so.
 */

/** What the plugin needs of the admin's GraphQL client (oxid-fe-core `GraphqlClient.execute`), structurally. */
export interface Executor {
  execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>;
}

export const SERIES_QUERY = `query AdminAnalyticsSeries($from: DateTime!, $to: DateTime!, $granularity: AdminAnalyticsGranularity!) {
  adminAnalyticsSeries(from: $from, to: $to, granularity: $granularity) {
    currency
    buckets { key orders sales customers }
  }
}`;

interface LiveBucket {
  key: string;
  orders: number;
  sales: number;
  customers: number;
}

export interface LiveSeriesAnswer {
  adminAnalyticsSeries: { currency: string; buckets: LiveBucket[] };
}

export type SourceKind = 'demo' | 'live';

export interface LiveSeries {
  series: Series;
  currency: string;
}

const ratio = (numerators: number[], denominators: number[]): number[] =>
  numerators.map((n, at) => (denominators[at]! > 0 ? n / denominators[at]! : 0));

/** The module's buckets as the plugin's `Series` (the ratios are computed here, as for the demo data). */
export function toSeries(answer: LiveSeriesAnswer): LiveSeries {
  const buckets = answer.adminAnalyticsSeries.buckets;
  const orders = buckets.map((bucket) => bucket.orders);
  const sales = buckets.map((bucket) => bucket.sales);
  const customers = buckets.map((bucket) => bucket.customers);
  const values: Record<MetricId, number[]> = {
    orders,
    sales,
    customers,
    ordersPerCustomer: ratio(orders, customers),
    salesPerCustomer: ratio(sales, customers),
    averageOrder: ratio(sales, orders),
  };
  return {
    series: { keys: buckets.map((bucket) => bucket.key), values },
    currency: answer.adminAnalyticsSeries.currency,
  };
}

const dayOf = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Asks the shop for a period; `null` when the module is not there, the right is missing or the shop refused. */
export async function fetchLiveSeries(
  client: Executor,
  range: { from: Date; to: Date },
  granularity: Granularity,
): Promise<LiveSeries | null> {
  try {
    const answer = await client.execute<LiveSeriesAnswer>(SERIES_QUERY, {
      from: dayOf(range.from),
      to: dayOf(range.to),
      granularity: granularity === 'weekly' ? 'WEEKLY' : 'DAILY',
    });
    return answer?.adminAnalyticsSeries ? toSeries(answer) : null;
  } catch {
    return null; // intentionally: the demo data is the fallback of every refusal
  }
}

let client: Executor | null = null;

/** Remembered by the plugin's `setup(context)`: the admin's client, when the admin hands one over. */
export function rememberClient(executor: Executor | null): void {
  client = executor;
}

export function liveClient(): Executor | null {
  return client;
}

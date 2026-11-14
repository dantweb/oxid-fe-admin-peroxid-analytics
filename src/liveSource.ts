import type { Granularity } from './series/buckets';
import type { MetricId, Series } from './series/metrics';
import type { PopularSubject, RankMeasure, Ranking } from './series/ranking';

/**
 * The shop's numbers, when the OXID module `peroxid_analytics` (dantweb/oxid-fe-admin-peroxid-analytics, folder
 * `source/extensions/oxid-fe-admin-peroxid-analytics`) is active and the admin holds `ADMIN_ANALYTICS_VIEW`: one
 * query, `adminAnalyticsSeries`, answers the buckets of a period already aggregated (no order, no customer, no
 * personal data leaves the shop). Without the module (the field is unknown), without the right or without a
 * session the plugin stays on its demo data (`src/ecw/demoData.ts`) and says so. The popular products and categories
 * come from `adminAnalyticsTopProducts` and `adminAnalyticsTopCategories` the same way (`fetchLiveRanking`).
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

const RANKING_FIELDS = `measure currency total topTotal topShare others othersShare
    items { rank entityId number title value share }`;

const rankingQuery = (
  name: string,
  field: string,
): string => `query ${name}($from: DateTime!, $to: DateTime!, $limit: Int!, $measure: AdminAnalyticsRankMeasure!) {
  ${field}(from: $from, to: $to, limit: $limit, measure: $measure) {
    ${RANKING_FIELDS}
  }
}`;

/** The two ranking queries by subject: aggregates only, no order and no customer. */
export const RANKING_QUERIES: Readonly<Record<PopularSubject, string>> = {
  products: rankingQuery('AdminAnalyticsTopProducts', 'adminAnalyticsTopProducts'),
  categories: rankingQuery('AdminAnalyticsTopCategories', 'adminAnalyticsTopCategories'),
};

const RANKING_FIELD: Readonly<Record<PopularSubject, string>> = {
  products: 'adminAnalyticsTopProducts',
  categories: 'adminAnalyticsTopCategories',
};

interface LiveRankItem {
  rank: number;
  entityId: string | null;
  number: string | null;
  title: string;
  value: number;
  share: number;
}

/** The module's `AdminAnalyticsRanking`, field for field. */
export interface LiveRankingAnswer {
  measure: 'SALES' | 'UNITS' | 'ORDERS';
  currency: string;
  total: number;
  topTotal: number;
  topShare: number;
  others: number;
  othersShare: number;
  items: LiveRankItem[];
}

export function toRanking(answer: LiveRankingAnswer): Ranking {
  const { items, measure, ...figures } = answer;
  return {
    ...figures,
    measure: measure.toLowerCase() as RankMeasure,
    items: items.map(({ entityId, ...item }) => ({ ...item, id: entityId })),
  };
}

/** Asks the shop for a ranking; `null` when the module is not there, the right is missing or the shop refused. */
export async function fetchLiveRanking(
  client: Executor,
  subject: PopularSubject,
  range: { from: Date; to: Date },
  limit: number,
  measure: RankMeasure,
): Promise<Ranking | null> {
  try {
    const answer = await client.execute<Record<string, LiveRankingAnswer | undefined>>(
      RANKING_QUERIES[subject],
      {
        from: dayOf(range.from),
        to: dayOf(range.to),
        limit,
        measure: measure.toUpperCase(),
      },
    );
    const ranking = answer?.[RANKING_FIELD[subject]];
    return ranking ? toRanking(ranking) : null;
  } catch {
    return null; // intentionally: the demo ranking is the fallback of every refusal
  }
}

export const SHARE_QUERY = `query AdminAnalyticsTopShareSeries($from: DateTime!, $to: DateTime!, $granularity: AdminAnalyticsGranularity!, $limit: Int!, $measure: AdminAnalyticsRankMeasure!) {
  adminAnalyticsTopShareSeries(from: $from, to: $to, granularity: $granularity, limit: $limit, measure: $measure) {
    buckets { key share }
  }
}`;

interface LiveShareAnswer {
  adminAnalyticsTopShareSeries?: { buckets: { key: string; share: number }[] };
}

/**
 * The share of the period's top N products per bucket, laid on the page's own bucket keys (a bucket the shop did not
 * name is 0). `null` when the module is not there, the right is missing or the shop refused.
 */
export async function fetchLiveTopShare(
  client: Executor,
  range: { from: Date; to: Date },
  granularity: Granularity,
  limit: number,
  measure: RankMeasure,
  keys: readonly string[],
): Promise<number[] | null> {
  try {
    const answer = await client.execute<LiveShareAnswer>(SHARE_QUERY, {
      from: dayOf(range.from),
      to: dayOf(range.to),
      granularity: granularity === 'weekly' ? 'WEEKLY' : 'DAILY',
      limit,
      measure: measure.toUpperCase(),
    });
    const buckets = answer?.adminAnalyticsTopShareSeries?.buckets;
    if (!buckets) {
      return null;
    }
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket.share]));
    return keys.map((key) => byKey.get(key) ?? 0);
  } catch {
    return null; // intentionally: the demo shares are the fallback of every refusal
  }
}

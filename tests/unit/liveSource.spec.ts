import { describe, expect, it } from 'vitest';
import { analyticsPlugin } from '../../src';
import {
  fetchLiveRanking,
  fetchLiveSeries,
  liveClient,
  rememberClient,
  RANKING_QUERIES,
  SERIES_QUERY,
  toRanking,
  toSeries,
  type Executor,
  type LiveRankingAnswer,
} from '../../src/liveSource';
import { useAnalytics } from '../../src/useAnalytics';

const TODAY = new Date(2026, 10, 4, 12);

const answer = (buckets: [string, number, number, number][]) => ({
  adminAnalyticsSeries: {
    currency: 'CHF',
    buckets: buckets.map(([key, orders, sales, customers]) => ({ key, orders, sales, customers })),
  },
});

/** A client that answers every period with the same two buckets (and records what it was asked). */
function answering(): Executor & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    execute: async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
      calls.push({ query, ...variables });
      return answer([
        ['2026-11-03', 2, 40, 1],
        ['2026-11-04', 1, 5.5, 0],
      ]) as unknown as T;
    },
  };
}

describe('toSeries', () => {
  it('maps the module’s buckets to the plugin’s series and computes the ratios zero-safe', () => {
    const { series, currency } = toSeries(
      answer([
        ['2026-11-03', 2, 40, 1],
        ['2026-11-04', 1, 5.5, 0],
      ]),
    );

    expect(currency).toBe('CHF');
    expect(series.keys).toEqual(['2026-11-03', '2026-11-04']);
    expect(series.values).toEqual({
      orders: [2, 1],
      sales: [40, 5.5],
      customers: [1, 0],
      ordersPerCustomer: [2, 0],
      salesPerCustomer: [40, 0],
      averageOrder: [20, 5.5],
    });
  });
});

describe('fetchLiveSeries', () => {
  it('asks for whole days and the module’s granularity names', async () => {
    const client = answering();

    const live = await fetchLiveSeries(
      client,
      { from: new Date(2026, 10, 3), to: new Date(2026, 10, 4) },
      'weekly',
    );

    expect(live?.currency).toBe('CHF');
    expect(client.calls[0]).toEqual({
      query: SERIES_QUERY,
      from: '2026-11-03',
      to: '2026-11-04',
      granularity: 'WEEKLY',
    });
    expect(SERIES_QUERY).toContain(
      'adminAnalyticsSeries(from: $from, to: $to, granularity: $granularity)',
    );
    expect(SERIES_QUERY).not.toMatch(/email|name|customer_id/);
  });

  it('answers null when the shop refuses (no module, no right, no session) or answers nothing', async () => {
    const refusing: Executor = {
      execute: async () => {
        throw new Error('Cannot query field "adminAnalyticsSeries" on type "Query"');
      },
    };
    const empty: Executor = { execute: async <T>(): Promise<T> => ({}) as unknown as T };

    expect(await fetchLiveSeries(refusing, { from: TODAY, to: TODAY }, 'daily')).toBeNull();
    expect(await fetchLiveSeries(empty, { from: TODAY, to: TODAY }, 'daily')).toBeNull();
  });
});

describe('useAnalytics with the shop', () => {
  it('shows the shop’s numbers and currency when the module answers, and asks again when the period changes', async () => {
    const client = answering();
    const analytics = useAnalytics({ today: TODAY, client });
    expect(analytics.source.value).toBe('demo');

    await analytics.ready;

    expect(analytics.source.value).toBe('live');
    expect(analytics.currency.value).toBe('CHF');
    expect(analytics.series.value.keys).toEqual(['2026-11-03', '2026-11-04']);
    expect(analytics.current.value.orders).toBe(3);
    expect(analytics.previous.value.orders).toBe(3); // the stub answers the previous period the same way
    expect(client.calls).toHaveLength(2); // the period and the period before it

    analytics.filters.granularity = 'weekly';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.calls.length).toBeGreaterThanOrEqual(4);
    expect(client.calls.at(-1)).toMatchObject({ granularity: 'WEEKLY' });
  });

  it('falls back to the demo data when the shop refuses', async () => {
    const refusing: Executor = {
      execute: async () => {
        throw new Error('permission_denied');
      },
    };
    const analytics = useAnalytics({ today: TODAY, client: refusing });

    await analytics.ready;

    expect(analytics.source.value).toBe('demo');
    expect(analytics.currency.value).toBe('EUR');
    expect(analytics.series.value.keys).toHaveLength(30);
  });

  it('without a client (a plain mount, no admin) it is demo data and makes no request', async () => {
    const analytics = useAnalytics({ today: TODAY, client: null });
    await analytics.ready;
    expect(analytics.source.value).toBe('demo');
  });
});

describe('the plugin remembers the admin’s client', () => {
  it('setup(context) keeps the client the admin hands over; useAnalytics picks it up by default', async () => {
    const client = answering();
    expect(liveClient()).toBeNull();

    analyticsPlugin.setup({ client });
    const analytics = useAnalytics({ today: TODAY });
    await analytics.ready;

    expect(liveClient()).toBe(client);
    expect(analytics.source.value).toBe('live');
    rememberClient(null);
  });
});

const rankingAnswer = (): LiveRankingAnswer => ({
  measure: 'UNITS',
  currency: 'CHF',
  total: 10,
  topTotal: 8,
  topShare: 80,
  others: 2,
  othersShare: 20,
  items: [
    { rank: 1, entityId: 'p1', number: 'A-1', title: 'Alpha', value: 5, share: 50 },
    { rank: 2, entityId: null, number: null, title: 'No category', value: 3, share: 30 },
  ],
});

describe('toRanking', () => {
  it('maps the module’s ranking to the plugin’s: lower-case measure, id instead of entityId', () => {
    const ranking = toRanking(rankingAnswer());

    expect(ranking).toEqual({
      measure: 'units',
      currency: 'CHF',
      total: 10,
      topTotal: 8,
      topShare: 80,
      others: 2,
      othersShare: 20,
      items: [
        { rank: 1, id: 'p1', number: 'A-1', title: 'Alpha', value: 5, share: 50 },
        { rank: 2, id: null, number: null, title: 'No category', value: 3, share: 30 },
      ],
    });
  });
});

describe('fetchLiveRanking', () => {
  const range = { from: new Date(2026, 10, 3), to: new Date(2026, 10, 4) };

  function ranking(field: string): Executor & { calls: Record<string, unknown>[] } {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      execute: async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
        calls.push({ query, ...variables });
        return { [field]: rankingAnswer() } as unknown as T;
      },
    };
  }

  it('asks the products with whole days, the limit and the module’s measure name', async () => {
    const client = ranking('adminAnalyticsTopProducts');

    const live = await fetchLiveRanking(client, 'products', range, 10, 'units');

    expect(live?.items).toHaveLength(2);
    expect(client.calls[0]).toEqual({
      query: RANKING_QUERIES.products,
      from: '2026-11-03',
      to: '2026-11-04',
      limit: 10,
      measure: 'UNITS',
    });
    expect(RANKING_QUERIES.products).toContain(
      'adminAnalyticsTopProducts(from: $from, to: $to, limit: $limit, measure: $measure)',
    );
  });

  it('asks the categories with their own query', async () => {
    const client = ranking('adminAnalyticsTopCategories');

    const live = await fetchLiveRanking(client, 'categories', range, 3, 'orders');

    expect(live?.currency).toBe('CHF');
    expect(client.calls[0]).toMatchObject({
      query: RANKING_QUERIES.categories,
      measure: 'ORDERS',
      limit: 3,
    });
    expect(RANKING_QUERIES.categories).toContain('adminAnalyticsTopCategories(');
  });

  it('asks for aggregates only: no order, no customer', () => {
    for (const query of Object.values(RANKING_QUERIES)) {
      expect(query).toContain('items { rank entityId number title value share }');
      expect(query).not.toMatch(/email|customer|orderId/i);
    }
  });

  it('answers null when the shop refuses (no module, no right, bad limit) or answers nothing', async () => {
    const refusing: Executor = {
      execute: async () => {
        throw new Error('Cannot query field "adminAnalyticsTopProducts" on type "Query"');
      },
    };
    const empty: Executor = { execute: async <T>(): Promise<T> => ({}) as unknown as T };

    expect(await fetchLiveRanking(refusing, 'products', range, 5, 'sales')).toBeNull();
    expect(await fetchLiveRanking(empty, 'categories', range, 5, 'sales')).toBeNull();
  });
});

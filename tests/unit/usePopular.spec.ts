import { describe, expect, it } from 'vitest';
import { computed } from 'vue';
import { generateDemoData } from '../../src/ecw/demoData';
import type { Executor, LiveRankingAnswer } from '../../src/liveSource';
import { lastDays } from '../../src/series/buckets';
import { usePopular } from '../../src/usePopular';

const TODAY = new Date(2026, 10, 4, 12);
const data = generateDemoData({ today: TODAY, days: 60, seed: 1 });
const range = computed(() => lastDays(TODAY, 30));

const answer = (): LiveRankingAnswer => ({
  measure: 'SALES',
  currency: 'CHF',
  total: 100,
  topTotal: 60,
  topShare: 60,
  others: 40,
  othersShare: 40,
  items: [{ rank: 1, entityId: 'p1', number: 'A', title: 'Alpha', value: 60, share: 60 }],
});

function answering(): Executor & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    execute: async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
      calls.push({ query, ...variables });
      return { adminAnalyticsTopProducts: answer() } as unknown as T;
    },
  };
}

describe('usePopular', () => {
  it('starts at the top 5 by sales as a pie, on the demo ranking of the period', async () => {
    const popular = usePopular('products', { range, data: () => data, client: null });
    await popular.ready;

    expect(popular.state).toEqual({ topN: 5, measure: 'sales', chart: 'pie' });
    expect(popular.source.value).toBe('demo');
    expect(popular.ranking.value.items).toHaveLength(5);
    expect(popular.ranking.value.currency).toBe('EUR');
    expect(popular.ranking.value.others).toBeGreaterThan(0);
  });

  it('the top N and the measure change the ranking without a request', async () => {
    const popular = usePopular('products', { range, data: () => data, client: null });
    await popular.ready;

    popular.state.topN = 10;
    popular.state.measure = 'units';

    expect(popular.ranking.value.items).toHaveLength(10);
    expect(popular.ranking.value.measure).toBe('units');
  });

  it('shows the shop’s ranking when the module answers, and asks again when N or the measure change', async () => {
    const client = answering();
    const popular = usePopular('products', { range, data: () => data, client });
    expect(popular.source.value).toBe('demo');

    await popular.ready;

    expect(popular.source.value).toBe('live');
    expect(popular.ranking.value.items.map((item) => item.title)).toEqual(['Alpha']);
    expect(client.calls[0]).toMatchObject({ limit: 5, measure: 'SALES' });

    popular.state.topN = 15;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.calls.at(-1)).toMatchObject({ limit: 15, measure: 'SALES' });
    popular.state.measure = 'orders';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.calls.at(-1)).toMatchObject({ limit: 15, measure: 'ORDERS' });
  });

  it('falls back to the demo ranking when the shop refuses', async () => {
    const refusing: Executor = {
      execute: async () => {
        throw new Error('permission_denied');
      },
    };
    const popular = usePopular('categories', { range, data: () => data, client: refusing });

    await popular.ready;

    expect(popular.source.value).toBe('demo');
    expect(popular.ranking.value.items.length).toBeGreaterThan(0);
  });
});

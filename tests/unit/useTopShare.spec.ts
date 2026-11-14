import { describe, expect, it } from 'vitest';
import { computed, reactive, ref } from 'vue';
import { generateDemoData } from '../../src/ecw/demoData';
import type { Executor } from '../../src/liveSource';
import { bucketKeys, lastDays } from '../../src/series/buckets';
import type { Granularity } from '../../src/series/buckets';
import type { PopularState } from '../../src/usePopular';
import { useTopShare } from '../../src/useTopShare';

const TODAY = new Date(2026, 10, 4, 12);
const data = generateDemoData({ today: TODAY, days: 60, seed: 1 });
const range = computed(() => lastDays(TODAY, 7));
const granularity = ref<Granularity>('daily');
const choice = (): PopularState =>
  reactive<PopularState>({ topN: 5, measure: 'sales', chart: 'pie' });

function answering(): Executor & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    execute: async <T>(query: string, variables?: Record<string, unknown>): Promise<T> => {
      calls.push({ query, ...variables });
      return {
        adminAnalyticsTopShareSeries: { buckets: [{ key: '2026-11-04', share: 61.5 }] },
      } as unknown as T;
    },
  };
}

const context = (client: Executor | null) => ({
  range,
  data: () => data,
  client,
  granularity: () => granularity.value,
});

describe('useTopShare', () => {
  it('is the demo share per bucket of the period without a shop, and follows Top N', async () => {
    const state = choice();
    const share = useTopShare(context(null), state);
    await share.ready;

    expect(share.source.value).toBe('demo');
    expect(share.values.value).toHaveLength(
      bucketKeys(range.value.from, range.value.to, 'daily').length,
    );
    const five = [...share.values.value];

    state.topN = 15;

    expect(share.values.value.every((value, at) => value >= five[at]!)).toBe(true);
    expect(share.values.value).not.toEqual(five);
  });

  it('shows the shop’s shares aligned on the calendar and asks again for another N, measure or granularity', async () => {
    const client = answering();
    const state = choice();
    const share = useTopShare(context(client), state);

    await share.ready;

    expect(share.source.value).toBe('live');
    expect(share.values.value.at(-1)).toBe(61.5);
    expect(share.values.value.slice(0, -1).every((value) => value === 0)).toBe(true);
    expect(client.calls[0]).toMatchObject({ limit: 5, measure: 'SALES', granularity: 'DAILY' });

    state.topN = 10;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.calls.at(-1)).toMatchObject({ limit: 10 });
    granularity.value = 'weekly';
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.calls.at(-1)).toMatchObject({ granularity: 'WEEKLY' });
    granularity.value = 'daily';
  });

  it('falls back to the demo shares when the shop refuses', async () => {
    const refusing: Executor = {
      execute: async () => {
        throw new Error('permission_denied');
      },
    };
    const share = useTopShare(context(refusing), choice());

    await share.ready;

    expect(share.source.value).toBe('demo');
    expect(share.values.value.length).toBeGreaterThan(0);
  });
});

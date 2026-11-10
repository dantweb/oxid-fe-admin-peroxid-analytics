import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';
import { generateDemoData } from './ecw/demoData';
import type { AnalyticsData } from './ecw/models';
import { fetchLiveSeries, liveClient, type Executor, type SourceKind } from './liveSource';
import { lastDays, previousRange, type Granularity } from './series/buckets';
import type { ChartKind } from './series/curve';
import { computeSeries, totals, type MetricId, type Series } from './series/metrics';
import type { ScaleKind } from './series/scale';

export type RangeDays = 7 | 30 | 90 | 180;

export const RANGES: readonly RangeDays[] = [7, 30, 90, 180];

export interface AnalyticsFilters {
  rangeDays: RangeDays;
  granularity: Granularity;
  metric: MetricId;
  scale: ScaleKind;
  chart: ChartKind;
}

export interface Analytics {
  filters: AnalyticsFilters;
  series: ComputedRef<Series>;
  current: ComputedRef<Record<MetricId, number>>;
  previous: ComputedRef<Record<MetricId, number>>;
  /** `live` while the shop's module answers, `demo` otherwise */
  source: Ref<SourceKind>;
  /** the shop's currency code when live, `EUR` for the demo data */
  currency: Ref<string>;
  /** resolves when the first live attempt (if any) is settled — for tests and the "loading" state */
  ready: Promise<void>;
}

let cached: AnalyticsData | null = null;

function demoData(today: Date): AnalyticsData {
  cached ??= generateDemoData({ today });
  return cached;
}

export interface UseAnalyticsOptions {
  today?: Date;
  data?: AnalyticsData;
  /** the admin's client; default: the one `setup()` remembered (none in a plain mount → demo only) */
  client?: Executor | null;
}

/**
 * The filter state and the series derived from it. Each change of period or granularity asks the shop's module
 * (when a client is there) and falls back to the demo data when it does not answer; the metric, the scale and the
 * chart type are views on the same series and cost no request.
 */
export function useAnalytics({
  today = new Date(),
  data,
  client = liveClient(),
}: UseAnalyticsOptions = {}): Analytics {
  const filters = reactive<AnalyticsFilters>({
    rangeDays: 30,
    granularity: 'daily',
    metric: 'sales',
    scale: 'linear',
    chart: 'curved',
  });
  const demo = (): AnalyticsData => data ?? demoData(today);
  const range = computed(() => lastDays(today, filters.rangeDays));
  const query = computed(() => ({ ...range.value, granularity: filters.granularity }));
  const previousQuery = computed(() => ({
    ...previousRange(range.value),
    granularity: filters.granularity,
  }));

  const source = ref<SourceKind>('demo');
  const currency = ref('EUR');
  const live = ref<{ current: Series; previous: Series } | null>(null);

  const demoSeries = computed(() => computeSeries(demo(), query.value));
  const demoPrevious = computed(() => computeSeries(demo(), previousQuery.value));

  async function refresh(): Promise<void> {
    if (client === null) {
      return;
    }
    const [current, before] = await Promise.all([
      fetchLiveSeries(client, range.value, filters.granularity),
      fetchLiveSeries(client, previousRange(range.value), filters.granularity),
    ]);
    if (current === null || before === null) {
      live.value = null;
      source.value = 'demo';
      currency.value = 'EUR';
      return;
    }
    live.value = { current: current.series, previous: before.series };
    currency.value = current.currency;
    source.value = 'live';
  }

  const ready = refresh();
  watch(query, () => void refresh());

  const series = computed(() => live.value?.current ?? demoSeries.value);
  const current = computed(() => totals(series.value));
  const previous = computed(() => totals(live.value?.previous ?? demoPrevious.value));
  return { filters, series, current, previous, source, currency, ready };
}

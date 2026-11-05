import { computed, reactive, type ComputedRef } from 'vue';
import { generateDemoData } from './ecw/demoData';
import type { AnalyticsData } from './ecw/models';
import { lastDays, previousRange, type Granularity } from './series/buckets';
import { computeSeries, totals, type MetricId, type Series } from './series/metrics';
import type { ScaleKind } from './series/scale';

export type RangeDays = 7 | 30 | 90 | 180;

export const RANGES: readonly RangeDays[] = [7, 30, 90, 180];

export interface AnalyticsFilters {
  rangeDays: RangeDays;
  granularity: Granularity;
  metric: MetricId;
  scale: ScaleKind;
}

export interface Analytics {
  filters: AnalyticsFilters;
  series: ComputedRef<Series>;
  current: ComputedRef<Record<MetricId, number>>;
  previous: ComputedRef<Record<MetricId, number>>;
}

let cached: AnalyticsData | null = null;

/** The demo data set, generated once per page load (a few thousand rows). */
function demoData(today: Date = new Date()): AnalyticsData {
  cached ??= generateDemoData({ today });
  return cached;
}

/** The filter state and the series derived from it; `today` and `data` are injectable for tests. */
export function useAnalytics(
  today: Date = new Date(),
  data: AnalyticsData = demoData(today),
): Analytics {
  const filters = reactive<AnalyticsFilters>({
    rangeDays: 30,
    granularity: 'daily',
    metric: 'sales',
    scale: 'linear',
  });
  const range = computed(() => lastDays(today, filters.rangeDays));
  const series = computed(() =>
    computeSeries(data, { ...range.value, granularity: filters.granularity }),
  );
  const current = computed(() => totals(series.value));
  const previous = computed(() =>
    totals(
      computeSeries(data, { ...previousRange(range.value), granularity: filters.granularity }),
    ),
  );
  return { filters, series, current, previous };
}

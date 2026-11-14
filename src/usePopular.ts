import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';
import { demoRankingEntries } from './ecw/demoRanking';
import type { AnalyticsData } from './ecw/models';
import { fetchLiveRanking, type Executor, type SourceKind } from './liveSource';
import {
  buildRanking,
  DEFAULT_TOP_N,
  type PopularSubject,
  type RankMeasure,
  type Ranking,
  type TopN,
} from './series/ranking';

export type PopularChart = 'pie' | 'bars';

export const POPULAR_CHARTS: readonly PopularChart[] = ['pie', 'bars'];

/** What the admin chose for one section: how many, by what, drawn how. */
export interface PopularState {
  topN: TopN;
  measure: RankMeasure;
  chart: PopularChart;
}

export interface Popular {
  state: PopularState;
  ranking: ComputedRef<Ranking>;
  /** `live` while the shop's module answers this section, `demo` otherwise */
  source: Ref<SourceKind>;
  /** resolves when the first live attempt (if any) is settled */
  ready: Promise<void>;
}

/** What a section shares with the page: the period of the filter bar, the demo data and the admin's client. */
export interface PopularContext {
  range: ComputedRef<{ from: Date; to: Date }>;
  data: () => AnalyticsData;
  client: Executor | null;
}

const DEMO_CURRENCY = 'EUR';

/**
 * The popular products or categories of the period. A change of the period, of N or of the measure asks the shop's
 * module (when a client is there) and falls back to the demo ranking when it does not answer; the chart type is a
 * view on the same ranking and costs no request.
 */
export function usePopular(subject: PopularSubject, context: PopularContext): Popular {
  const state = reactive<PopularState>({ topN: DEFAULT_TOP_N, measure: 'sales', chart: 'pie' });
  const source = ref<SourceKind>('demo');
  const live = ref<Ranking | null>(null);
  let latest = 0;

  const demo = computed(() =>
    buildRanking(
      demoRankingEntries(context.data(), subject, context.range.value, state.measure),
      state.topN,
      state.measure,
      DEMO_CURRENCY,
    ),
  );

  async function refresh(): Promise<void> {
    if (context.client === null) {
      return;
    }
    const request = ++latest;
    const ranking = await fetchLiveRanking(
      context.client,
      subject,
      context.range.value,
      state.topN,
      state.measure,
    );
    if (request !== latest) {
      return; // a newer choice is already on its way
    }
    live.value = ranking;
    source.value = ranking === null ? 'demo' : 'live';
  }

  const ready = refresh();
  watch(
    () => [context.range.value, state.topN, state.measure],
    () => void refresh(),
  );

  const ranking = computed(() => live.value ?? demo.value);
  return { state, ranking, source, ready };
}

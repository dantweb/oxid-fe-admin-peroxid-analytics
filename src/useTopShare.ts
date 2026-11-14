import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { demoTopShare } from './ecw/demoRanking';
import { fetchLiveTopShare, type SourceKind } from './liveSource';
import { bucketKeys, type Granularity } from './series/buckets';
import type { PopularContext, PopularState } from './usePopular';

/** What the share curve shares with the page: the popular context and the granularity of the curve. */
export interface ShareContext extends PopularContext {
  granularity: () => Granularity;
}

export interface TopShare {
  /** percent per bucket of the page's calendar */
  values: ComputedRef<number[]>;
  source: Ref<SourceKind>;
  ready: Promise<void>;
}

/**
 * The share that the top N products hold in each bucket, for the curve "Share of top N products". N and the measure
 * are those of the products section. Asks the shop's module when a client is there, falls back to the demo shares.
 */
export function useTopShare(context: ShareContext, choice: PopularState): TopShare {
  const source = ref<SourceKind>('demo');
  const live = ref<number[] | null>(null);
  let latest = 0;
  const keys = (): string[] =>
    bucketKeys(context.range.value.from, context.range.value.to, context.granularity());

  const demo = computed(() =>
    demoTopShare(
      context.data(),
      context.range.value,
      context.granularity(),
      choice.topN,
      choice.measure,
    ),
  );

  async function refresh(): Promise<void> {
    if (context.client === null) {
      return;
    }
    const request = ++latest;
    const shares = await fetchLiveTopShare(
      context.client,
      context.range.value,
      context.granularity(),
      choice.topN,
      choice.measure,
      keys(),
    );
    if (request !== latest) {
      return; // a newer choice is already on its way
    }
    live.value = shares;
    source.value = shares === null ? 'demo' : 'live';
  }

  const ready = refresh();
  watch(
    () => [context.range.value, context.granularity(), choice.topN, choice.measure],
    () => void refresh(),
  );

  return { values: computed(() => live.value ?? demo.value), source, ready };
}

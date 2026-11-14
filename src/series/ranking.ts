/**
 * Popular products and categories: what a ranking is and how it is put together. The shop (module
 * `peroxid_analytics`) answers a finished ranking; the demo source hands over all entries and `buildRanking` makes the
 * same ranking of them, with the same rules: the top N, an "others" remainder so that the whole is shown, and shares
 * with one decimal that add up to exactly 100.
 */
export type RankMeasure = 'sales' | 'units' | 'orders';

export const RANK_MEASURES: readonly RankMeasure[] = ['sales', 'units', 'orders'];

export type PopularSubject = 'products' | 'categories';

export const TOP_N_CHOICES = [3, 5, 10, 15, 20] as const;

export type TopN = (typeof TOP_N_CHOICES)[number];

export const DEFAULT_TOP_N: TopN = 5;

/** One product or category of the period with its value in the unit of the measure. `id` is null for "no category". */
export interface RankedEntry {
  id: string | null;
  number: string | null;
  title: string;
  value: number;
}

export interface RankItem extends RankedEntry {
  rank: number;
  /** percent of the total, one decimal */
  share: number;
}

export interface Ranking {
  measure: RankMeasure;
  currency: string;
  total: number;
  topTotal: number;
  /** percent of the total that the items hold (the sum of their shares) */
  topShare: number;
  others: number;
  othersShare: number;
  items: RankItem[];
}

const TENTHS = 1000;
const EPSILON = 1e-9;

const cents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Percentages with one decimal that add up to exactly 100 (largest remainder method): rounding each share on its own
 * would show 33.3 + 33.3 + 33.3. Without a total there is nothing to share and every share is 0.
 */
export function roundShares(values: readonly number[], total: number): number[] {
  if (total <= 0 || values.length === 0) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value / total) * TENTHS);
  const tenths = exact.map((share) => Math.floor(share + EPSILON));
  const leftOver = TENTHS - tenths.reduce((sum, tenth) => sum + tenth, 0);
  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - tenths[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const { index } of byRemainder.slice(0, Math.max(0, leftOver))) {
    tenths[index] = tenths[index]! + 1;
  }
  return tenths.map((tenth) => tenth / 10);
}

const idOf = (entry: RankedEntry): string => entry.id ?? '';

/** Value descending, then title, then id: the order of the shop's module, so both sources agree on ties. */
const byRank = (left: RankedEntry, right: RankedEntry): number =>
  right.value - left.value ||
  left.title.localeCompare(right.title, 'en') ||
  idOf(left).localeCompare(idOf(right), 'en');

export function buildRanking(
  entries: readonly RankedEntry[],
  limit: number,
  measure: RankMeasure,
  currency: string,
): Ranking {
  const sorted = [...entries].sort(byRank);
  const top = sorted.slice(0, limit);
  const total = cents(sorted.reduce((sum, entry) => sum + entry.value, 0));
  const topTotal = cents(top.reduce((sum, entry) => sum + entry.value, 0));
  const others = Math.max(0, cents(total - topTotal));
  const shares = roundShares([...top.map((entry) => entry.value), others], total);
  const othersShare = shares.pop() ?? 0;
  return {
    measure,
    currency,
    total,
    topTotal,
    topShare: Math.round(shares.reduce((sum, share) => sum + share, 0) * 10) / 10,
    others,
    othersShare,
    items: top.map((entry, at) => ({
      ...entry,
      rank: at + 1,
      value: cents(entry.value),
      share: shares[at]!,
    })),
  };
}

/** One piece of a chart: a ranked item, or everything outside the list. */
export interface RankSlice {
  /** unique within the ranking; `none-<rank>` is an item without an id, `others` the remainder */
  key: string;
  kind: 'item' | 'others';
  title: string;
  value: number;
  share: number;
}

const OTHERS_KEY = 'others';
const NONE_KEY = 'none';

/** The items and, when something is left over, one "others" slice: the whole, as the charts show it. */
export function rankingSlices(ranking: Ranking): RankSlice[] {
  const slices: RankSlice[] = ranking.items.map((item) => ({
    key: item.id ?? `${NONE_KEY}-${item.rank}`,
    kind: 'item',
    title: item.title,
    value: item.value,
    share: item.share,
  }));
  if (ranking.others > 0) {
    slices.push({
      key: OTHERS_KEY,
      kind: 'others',
      title: '',
      value: ranking.others,
      share: ranking.othersShare,
    });
  }
  return slices;
}

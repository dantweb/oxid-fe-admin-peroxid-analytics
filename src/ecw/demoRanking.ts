import { inRange } from '../series/buckets';
import type { PopularSubject, RankedEntry, RankMeasure } from '../series/ranking';
import { createRandom } from './random';
import type { AnalyticsData } from './models';

/**
 * Demo rankings for the page without the shop module: a small catalogue whose sales follow a long tail (a few
 * best sellers, many small ones), laid over the demo orders of the period. The values add up to exactly what the
 * demo orders of the period are worth (sales), hold (units) or number (orders, counted once per product), so the
 * rankings agree with the stat tiles above them. Deterministic for a period; no shop and no backend are involved.
 */
export interface DemoProduct {
  id: string;
  number: string;
  title: string;
  /** null: a product without a main category */
  categoryId: string | null;
  weight: number;
}

const CATEGORIES: Readonly<Record<string, string>> = {
  'demo-c-jeans': 'Jeans',
  'demo-c-shirts': 'T-Shirts',
  'demo-c-shoes': 'Sneakers',
  'demo-c-bags': 'Backpacks',
  'demo-c-watches': 'Watches',
};

const CATALOGUE: readonly [string, string, string | null][] = [
  ['Kuyichi Jeans Mick', 'JEANS-01', 'demo-c-jeans'],
  ['Wakeboard Bar Set', 'SPORT-02', null],
  ['Organic Cotton T-Shirt', 'SHIRT-03', 'demo-c-shirts'],
  ['Canvas Sneaker Low', 'SHOE-04', 'demo-c-shoes'],
  ['Everyday Backpack 20L', 'BAG-05', 'demo-c-bags'],
  ['Slim Fit Jeans Dark', 'JEANS-06', 'demo-c-jeans'],
  ['Striped Longsleeve', 'SHIRT-07', 'demo-c-shirts'],
  ['Trail Sneaker', 'SHOE-08', 'demo-c-shoes'],
  ['Steel Watch Classic', 'WATCH-09', 'demo-c-watches'],
  ['Graphic T-Shirt Wave', 'SHIRT-10', 'demo-c-shirts'],
  ['Leather Belt Brown', 'ACC-11', null],
  ['Roll-Top Bag', 'BAG-12', 'demo-c-bags'],
  ['Straight Jeans Light', 'JEANS-13', 'demo-c-jeans'],
  ['Minimal Watch Black', 'WATCH-14', 'demo-c-watches'],
  ['High-Top Sneaker', 'SHOE-15', 'demo-c-shoes'],
  ['Pocket T-Shirt', 'SHIRT-16', 'demo-c-shirts'],
  ['Sports Watch Digital', 'WATCH-17', 'demo-c-watches'],
  ['Cord Wallet', 'ACC-18', null],
];

const LONG_TAIL = 0.9;

export const DEMO_PRODUCTS: readonly DemoProduct[] = CATALOGUE.map(
  ([title, number, categoryId], at) => ({
    id: `demo-p${String(at + 1).padStart(2, '0')}`,
    number,
    title,
    categoryId,
    weight: 1 / (at + 1) ** LONG_TAIL,
  }),
);

/** How many products an order holds on average, for the "number of orders" measure. */
const PRODUCTS_PER_ORDER = 2.2;
const JITTER_FROM = 0.6;
const JITTER_TO = 1.4;
const NO_CATEGORY = 'No category';
const DAY_MS = 86_400_000;

const MEASURE_SALT: Readonly<Record<RankMeasure, number>> = { sales: 11, units: 23, orders: 37 };

const dayNumber = (date: Date): number => Math.floor(date.getTime() / DAY_MS);

interface PeriodTotals {
  orders: number;
  units: number;
  /** in cents */
  cents: number;
}

function totalsOf(data: AnalyticsData, range: { from: Date; to: Date }): PeriodTotals {
  const totals: PeriodTotals = { orders: 0, units: 0, cents: 0 };
  for (const row of data.orders.rows) {
    if (!inRange(row.get<Date>('timestamp'), range)) {
      continue;
    }
    totals.orders += 1;
    totals.units += row.get<number>('order_items_count');
    totals.cents += Math.round(row.get<number>('order_brutto') * 100);
  }
  return totals;
}

/** Splits `whole` into whole parts in proportion to `weights` (largest remainder): the parts add up to `whole`. */
function allocate(whole: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const exact = weights.map((weight) => (weight / sum) * whole);
  const parts = exact.map(Math.floor);
  const leftOver = whole - parts.reduce((total, part) => total + part, 0);
  exact
    .map((share, index) => ({ index, remainder: share - parts[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .slice(0, leftOver)
    .forEach(({ index }) => {
      parts[index] = parts[index]! + 1;
    });
  return parts;
}

function productValues(
  data: AnalyticsData,
  range: { from: Date; to: Date },
  measure: RankMeasure,
): number[] {
  const totals = totalsOf(data, range);
  const whole = {
    sales: totals.cents,
    units: totals.units,
    orders: Math.round(totals.orders * PRODUCTS_PER_ORDER),
  }[measure];
  if (whole <= 0) {
    return DEMO_PRODUCTS.map(() => 0);
  }
  const weights = DEMO_PRODUCTS.map((product, at) => {
    const seed =
      Math.imul(dayNumber(range.from), 73856093) ^
      Math.imul(dayNumber(range.to), 19349663) ^
      Math.imul(at + 1, 83492791) ^
      MEASURE_SALT[measure];
    return product.weight * createRandom(seed).float(JITTER_FROM, JITTER_TO);
  });
  const parts = allocate(whole, weights);
  return measure === 'sales' ? parts.map((cents) => cents / 100) : parts;
}

function categoryEntries(products: RankedEntry[]): RankedEntry[] {
  const byCategory = new Map<string | null, number>();
  DEMO_PRODUCTS.forEach((product, at) => {
    byCategory.set(
      product.categoryId,
      (byCategory.get(product.categoryId) ?? 0) + products[at]!.value,
    );
  });
  return [...byCategory].map(([id, value]) => ({
    id,
    number: null,
    title: id === null ? NO_CATEGORY : (CATEGORIES[id] ?? id),
    value: Math.round(value * 100) / 100,
  }));
}

/** Every product (or category) of the period with a value, best first or not: `buildRanking` sorts and cuts. */
export function demoRankingEntries(
  data: AnalyticsData,
  subject: PopularSubject,
  range: { from: Date; to: Date },
  measure: RankMeasure,
): RankedEntry[] {
  const values = productValues(data, range, measure);
  const products: RankedEntry[] = DEMO_PRODUCTS.map((product, at) => ({
    id: product.id,
    number: product.number,
    title: product.title,
    value: values[at]!,
  }));
  const entries = subject === 'products' ? products : categoryEntries(products);
  return entries.filter((entry) => entry.value > 0);
}

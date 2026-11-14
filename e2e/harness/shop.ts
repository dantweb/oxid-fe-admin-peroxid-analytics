import { buildRanking, type RankedEntry, type RankMeasure } from '../../src/series/ranking';
import type { Executor, LiveRankingAnswer } from '../../src/liveSource';

/**
 * A stand-in for the shop's `peroxid_analytics` module: the same three queries, answered from a fixed catalogue with
 * the plugin's own ranking rules. The page records every request on `window.__shopCalls` for the spec.
 */
const PRODUCTS: readonly [string, string, string, string | null, number][] = [
  ['p01', 'JEANS-01', 'Kuyichi Jeans Mick', 'c-jeans', 4200],
  ['p02', 'SPORT-02', 'Wakeboard Bar Set', null, 3100],
  [
    'p03',
    'SHIRT-03',
    'Organic Cotton T-Shirt with a very long product title that has to wrap on a narrow screen',
    'c-shirts',
    2400,
  ],
  ['p04', 'SHOE-04', 'Canvas Sneaker Low', 'c-shoes', 1900],
  ['p05', 'BAG-05', 'Everyday Backpack 20L', 'c-bags', 1500],
  ['p06', 'JEANS-06', 'Slim Fit Jeans Dark', 'c-jeans', 1200],
  ['p07', 'SHIRT-07', 'Striped Longsleeve', 'c-shirts', 980],
  ['p08', 'SHOE-08', 'Trail Sneaker', 'c-shoes', 860],
  ['p09', 'WATCH-09', 'Steel Watch Classic', 'c-watches', 700],
  ['p10', 'SHIRT-10', 'Graphic T-Shirt Wave', 'c-shirts', 610],
  ['p11', 'ACC-11', 'Leather Belt Brown', null, 540],
  ['p12', 'BAG-12', 'Roll-Top Bag', 'c-bags', 470],
  ['p13', 'JEANS-13', 'Straight Jeans Light', 'c-jeans', 400],
  ['p14', 'WATCH-14', 'Minimal Watch Black', 'c-watches', 350],
  ['p15', 'SHOE-15', 'High-Top Sneaker', 'c-shoes', 300],
  ['p16', 'SHIRT-16', 'Pocket T-Shirt', 'c-shirts', 260],
  ['p17', 'WATCH-17', 'Sports Watch Digital', 'c-watches', 210],
  ['p18', 'ACC-18', 'Cord Wallet', null, 150],
];

const CATEGORY_TITLES: Readonly<Record<string, string>> = {
  'c-jeans': 'Jeans',
  'c-shirts': 'T-Shirts',
  'c-shoes': 'Sneakers',
  'c-bags': 'Backpacks',
  'c-watches': 'Watches',
};

const FACTOR: Readonly<Record<RankMeasure, number>> = { sales: 1, units: 0.04, orders: 0.025 };

function entries(subject: 'products' | 'categories', measure: RankMeasure): RankedEntry[] {
  const scaled = PRODUCTS.map(([id, number, title, category, sales]) => ({
    id,
    number,
    title,
    category,
    value: Math.round(sales * FACTOR[measure] * 100) / 100,
  }));
  if (subject === 'products') {
    return scaled.map(({ id, number, title, value }) => ({ id, number, title, value }));
  }
  const byCategory = new Map<string | null, number>();
  for (const { category, value } of scaled) {
    byCategory.set(category, (byCategory.get(category) ?? 0) + value);
  }
  return [...byCategory].map(([id, value]) => ({
    id,
    number: null,
    title: id === null ? 'No category' : (CATEGORY_TITLES[id] ?? id),
    value,
  }));
}

function ranking(
  subject: 'products' | 'categories',
  limit: number,
  measure: RankMeasure,
): LiveRankingAnswer {
  const built = buildRanking(entries(subject, measure), limit, measure, 'EUR');
  const { items, ...figures } = built;
  return {
    ...figures,
    measure: measure.toUpperCase() as LiveRankingAnswer['measure'],
    items: items.map(({ id, ...item }) => ({ ...item, entityId: id })),
  };
}

const dayKey = (day: Date): string =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

/** The ISO Monday of a day, as the module keys a weekly bucket. */
function mondayOf(day: Date): Date {
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return monday;
}

function series(from: string, to: string, granularity: string) {
  const buckets = new Map<
    string,
    { key: string; orders: number; sales: number; customers: number }
  >();
  const last = new Date(`${to}T00:00:00`);
  for (let day = new Date(`${from}T00:00:00`); day <= last; day.setDate(day.getDate() + 1)) {
    const key = dayKey(granularity === 'WEEKLY' ? mondayOf(day) : day);
    const bucket = buckets.get(key) ?? { key, orders: 0, sales: 0, customers: 0 };
    bucket.orders += 8 + (day.getDate() % 7);
    bucket.sales += 700 + day.getDate() * 23;
    bucket.customers += 2 + (day.getDate() % 4);
    buckets.set(key, bucket);
  }
  return { currency: 'EUR', buckets: [...buckets.values()] };
}

export function mockShop(calls: Record<string, unknown>[]): Executor {
  return {
    execute: async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
      calls.push({ query: query.slice(0, 60), ...variables });
      if (query.includes('adminAnalyticsSeries')) {
        return {
          adminAnalyticsSeries: series(
            String(variables.from),
            String(variables.to),
            String(variables.granularity),
          ),
        } as T;
      }
      const measure = String(variables.measure).toLowerCase() as RankMeasure;
      const limit = Number(variables.limit);
      return {
        adminAnalyticsTopProducts: ranking('products', limit, measure),
        adminAnalyticsTopCategories: ranking('categories', limit, measure),
      } as T;
    },
  };
}

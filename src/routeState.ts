import { watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { applyFilters, filtersFromQuery, queryFromFilters, type QueryValue } from './routeFilters';
import { DEFAULT_TOP_N, RANK_MEASURES, TOP_N_CHOICES } from './series/ranking';
import type { AnalyticsFilters } from './useAnalytics';
import { POPULAR_CHARTS, type PopularState } from './usePopular';

/**
 * The whole state of the page as a route query, both ways: the filters (`routeFilters.ts`), `table=open`, and the three
 * choices of each ranking section: `pTop`, `pMeasure`, `pChart` for the products, `cTop`, `cMeasure`, `cChart` for the
 * categories. A link shows exactly that view. A value that is not allowed is ignored, so the control keeps its default;
 * a key that is at its default is not written.
 */
export interface PageState {
  filters: AnalyticsFilters;
  table: boolean;
  products: PopularState;
  categories: PopularState;
}

export interface PageStatePatch {
  filters: Partial<AnalyticsFilters>;
  table?: boolean;
  products: Partial<PopularState>;
  categories: Partial<PopularState>;
}

type Query = Record<string, QueryValue>;

const first = (value: QueryValue): string | undefined => {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' ? one : undefined;
};

/** Keys that only the arguments of an export or of a ranking view action carry (`chart` there means pie or bars). */
const ACTION_KEYS = ['format', 'subject'];

function popularFromQuery(query: Query, prefix: 'p' | 'c'): Partial<PopularState> {
  const topN = TOP_N_CHOICES.find((n) => String(n) === first(query[`${prefix}Top`]));
  const measure = RANK_MEASURES.find((m) => m === first(query[`${prefix}Measure`]));
  const chart = POPULAR_CHARTS.find((c) => c === first(query[`${prefix}Chart`]));
  return {
    ...(topN === undefined ? {} : { topN }),
    ...(measure === undefined ? {} : { measure }),
    ...(chart === undefined ? {} : { chart }),
  };
}

export function pageStateFromQuery(query: Query): PageStatePatch {
  if (ACTION_KEYS.some((key) => query[key] !== undefined)) {
    return { filters: {}, products: {}, categories: {} };
  }
  const table = first(query.table);
  return {
    filters: filtersFromQuery(query),
    ...(table === 'open' || table === 'closed' ? { table: table === 'open' } : {}),
    products: popularFromQuery(query, 'p'),
    categories: popularFromQuery(query, 'c'),
  };
}

function popularToQuery(state: PopularState, prefix: 'p' | 'c'): Record<string, string> {
  return {
    ...(state.topN === DEFAULT_TOP_N ? {} : { [`${prefix}Top`]: String(state.topN) }),
    ...(state.measure === 'sales' ? {} : { [`${prefix}Measure`]: state.measure }),
    ...(state.chart === 'pie' ? {} : { [`${prefix}Chart`]: state.chart }),
  };
}

export function queryFromPageState(state: PageState): Record<string, string> {
  return {
    ...queryFromFilters(state.filters),
    ...(state.table ? { table: 'open' } : {}),
    ...popularToQuery(state.products, 'p'),
    ...popularToQuery(state.categories, 'c'),
  };
}

function applyPatch(
  patch: PageStatePatch,
  filters: AnalyticsFilters,
  table: Ref<boolean>,
  products: PopularState,
  categories: PopularState,
): void {
  applyFilters(filters, patch.filters);
  if (patch.table !== undefined && table.value !== patch.table) {
    table.value = patch.table;
  }
  Object.assign(products, patch.products);
  Object.assign(categories, patch.categories);
}

const sameQuery = (left: Query, right: Record<string, string>): boolean =>
  JSON.stringify(Object.entries(left).sort()) === JSON.stringify(Object.entries(right).sort());

/**
 * Keeps the page and its route query in step. The query opens the view (and re-opens it while the page is shown); a
 * changed control writes the query back with `replace`, so the address is always a link to what is on screen.
 */
export function useRouteState(
  filters: AnalyticsFilters,
  table: Ref<boolean>,
  products: PopularState,
  categories: PopularState,
): void {
  const route = useRoute();
  const router = useRouter();
  const read = (query: Query): void =>
    applyPatch(pageStateFromQuery(query), filters, table, products, categories);
  read(route.query);
  watch(() => route.query, read);
  watch(
    () => [{ ...filters }, table.value, { ...products }, { ...categories }],
    () => {
      const query = queryFromPageState({
        filters,
        table: table.value,
        products,
        categories,
      });
      if (!sameQuery(route.query, query)) {
        void router.replace({ query });
      }
    },
  );
}

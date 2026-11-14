import { describe, expect, it } from 'vitest';
import { pageStateFromQuery, queryFromPageState, type PageState } from '../../src/routeState';
import { DEFAULT_FILTERS } from '../../src/useAnalytics';

const DEFAULT_POPULAR = { topN: 5, measure: 'sales', chart: 'pie' } as const;
const state = (extra: Partial<PageState> = {}): PageState => ({
  filters: { ...DEFAULT_FILTERS },
  table: false,
  products: { ...DEFAULT_POPULAR },
  categories: { ...DEFAULT_POPULAR },
  ...extra,
});

describe('pageStateFromQuery', () => {
  it('reads the table and the three choices of each ranking section', () => {
    expect(
      pageStateFromQuery({
        table: 'open',
        pTop: '10',
        pMeasure: 'units',
        pChart: 'bars',
        cTop: '3',
        cMeasure: 'orders',
        cChart: 'bars',
      }),
    ).toEqual({
      filters: {},
      table: true,
      products: { topN: 10, measure: 'units', chart: 'bars' },
      categories: { topN: 3, measure: 'orders', chart: 'bars' },
    });
  });

  it('reads the filters as before, in the same patch', () => {
    expect(pageStateFromQuery({ period: '7', curve: 'topShare', table: 'closed' })).toEqual({
      filters: { rangeDays: 7, from: '', to: '', metric: 'topShare' },
      table: false,
      products: {},
      categories: {},
    });
  });

  it.each([
    ['table', { table: 'maybe' }],
    ['a top N that is not offered', { pTop: '7', cTop: '25' }],
    ['a top N that is not a number', { pTop: 'many' }],
    ['a measure that is not known', { pMeasure: 'profit', cMeasure: '' }],
    ['a chart that is not pie or bars', { pChart: 'curved', cChart: 'donut' }],
  ])('ignores %s, so the control keeps its default', (_name, query) => {
    expect(pageStateFromQuery(query)).toEqual({ filters: {}, products: {}, categories: {} });
  });

  it('takes the first of a repeated key and ignores null', () => {
    expect(pageStateFromQuery({ pTop: ['15', '3'], cTop: null })).toEqual({
      filters: {},
      products: { topN: 15 },
      categories: {},
    });
  });

  it('reads nothing from the arguments of an export or of a ranking view action: their handlers own that state', () => {
    // `chart=bars` of such an action means the pie or bars of a ranking, not the chart type of the curve
    expect(pageStateFromQuery({ format: 'pdf', chart: 'bars', period: '7' })).toEqual({
      filters: {},
      products: {},
      categories: {},
    });
    expect(pageStateFromQuery({ subject: 'categories', limit: '3', chart: 'bars' })).toEqual({
      filters: {},
      products: {},
      categories: {},
    });
  });
});

describe('queryFromPageState', () => {
  it('writes only the five filters while everything else is at its default', () => {
    expect(queryFromPageState(state())).toEqual({
      period: '30',
      granularity: 'daily',
      curve: 'sales',
      scale: 'linear',
      chart: 'curved',
    });
  });

  it('adds what differs from the default: the open table and each changed ranking choice', () => {
    const query = queryFromPageState(
      state({
        table: true,
        products: { topN: 10, measure: 'sales', chart: 'bars' },
        categories: { topN: 5, measure: 'units', chart: 'pie' },
      }),
    );

    expect(query).toMatchObject({ table: 'open', pTop: '10', pChart: 'bars', cMeasure: 'units' });
    expect(query).not.toHaveProperty('pMeasure');
    expect(query).not.toHaveProperty('cTop');
    expect(query).not.toHaveProperty('cChart');
  });

  it('round-trips: what the page writes, it reads back', () => {
    const wanted = state({
      table: true,
      products: { topN: 15, measure: 'orders', chart: 'bars' },
      categories: { topN: 3, measure: 'units', chart: 'bars' },
    });

    const patch = pageStateFromQuery(queryFromPageState(wanted));

    expect(patch.table).toBe(true);
    expect({ ...DEFAULT_POPULAR, ...patch.products }).toEqual(wanted.products);
    expect({ ...DEFAULT_POPULAR, ...patch.categories }).toEqual(wanted.categories);
    expect({ ...DEFAULT_FILTERS, ...patch.filters }).toEqual(wanted.filters);
  });
});

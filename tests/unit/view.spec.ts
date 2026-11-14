import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import AnalyticsTile from '../../src/AnalyticsTile.vue';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { flushPromises } from '@vue/test-utils';
import { mountAtRoute, mountInAdmin } from './helpers';

describe('AnalyticsView', () => {
  it('renders the note, the filter row, five tiles, the curve and the table of the last 30 days', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();

    expect(wrapper.get('[data-test="analytics-note"]').text()).toContain('Demo data');
    expect(wrapper.get('[data-test="analytics-note"]').attributes('data-source')).toBe('demo');
    expect(wrapper.get('[data-test="analytics-filters"]').findAll('select')).toHaveLength(5);
    const tiles = wrapper.findAll('[data-test^="stat-"][data-test$="-value"]');
    expect(tiles.map((tile) => tile.attributes('data-test'))).toEqual([
      'stat-orders-value',
      'stat-sales-value',
      'stat-customers-value',
      'stat-salesPerCustomer-value',
      'stat-averageOrder-value',
    ]);
    expect(wrapper.get('[data-test="stat-averageOrder-value"]').text()).toMatch(/^€/);
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Sales, daily');
    expect(wrapper.get('[data-test="chart-line"]').attributes('d')).toMatch(/^M.* C/);
    expect(wrapper.findAll('[data-test="table-row"]')).toHaveLength(30);
    expect(wrapper.findAll('[data-test="x-tick"]').length).toBeGreaterThanOrEqual(5);
  });

  it('shows the popular products and categories of the same period below the curve', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();

    expect(wrapper.get('[data-test="popular-products"] h2').text()).toBe('Popular products');
    expect(wrapper.get('[data-test="popular-categories"] h2').text()).toBe('Popular categories');
    expect(
      wrapper.findAll('[data-test="popular-products"] [data-test="popular-row"]'),
    ).toHaveLength(5);
    const before = wrapper
      .get('[data-test="popular-products"] [data-test="popular-headline"]')
      .text();

    await wrapper.get('[data-test="filter-range"]').setValue('7');

    expect(
      wrapper.get('[data-test="popular-products"] [data-test="popular-headline"]').text(),
    ).not.toBe(before);
  });

  it('the filters scope everything: 7 days weekly gives one or two buckets, the curve and the table follow', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await wrapper.get('[data-test="filter-range"]').setValue('7');
    await wrapper.get('[data-test="filter-granularity"]').setValue('weekly');
    await wrapper.get('[data-test="filter-metric"]').setValue('ordersPerCustomer');

    const rows = wrapper.findAll('[data-test="table-row"]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Orders per customer, weekly');
    expect(wrapper.find('[data-test="log-note"]').exists()).toBe(false);
  });

  it('the log scale explains its baseline and keeps the ticks at powers of ten', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await wrapper.get('[data-test="filter-scale"]').setValue('log');

    expect(wrapper.get('[data-test="log-note"]').text()).toContain('Logarithmic');
    const ticks = wrapper.findAll('[data-test="y-tick"]').map((tick) => tick.text());
    expect(ticks[0]).toBe('€1');
    expect(ticks).toContain('€10');
  });

  it('the chart type switches between straight segments, the curve and bars; the readout works for all', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    const select = wrapper.get('[data-test="filter-chart"]');
    expect((select.element as HTMLSelectElement).value).toBe('curved');
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Linear',
      'Curved',
      'Bars',
    ]);

    await select.setValue('linear');
    const straight = wrapper.get('[data-test="chart-line"]').attributes('d') ?? '';
    expect(straight).toMatch(/^M[^C]*$/);
    expect(straight.match(/ L/g)).toHaveLength(29);
    expect(wrapper.find('[data-test="chart-bars"]').exists()).toBe(false);

    await select.setValue('bars');
    expect(wrapper.find('[data-test="chart-line"]').exists()).toBe(false);
    const rects = wrapper.findAll('[data-test="chart-bar"]');
    expect(rects).toHaveLength(30);
    expect(Number(rects[0]!.attributes('x'))).toBeGreaterThanOrEqual(60); // inside the plot, not on its edge
    await wrapper.get('[data-test="chart-svg"]').trigger('keydown', { key: 'End' });
    expect(wrapper.find('[data-test="chart-tooltip"]').exists()).toBe(true);
    expect(rects[29]!.classes()).toContain('chart__bar--hovered');

    await select.setValue('curved');
    expect(wrapper.get('[data-test="chart-line"]').attributes('d')).toMatch(/^M.* C/);
  });

  it('the curve "Share of top N products" is drawn in percent with the N of the products section', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();
    const options = wrapper.get('[data-test="filter-metric"]').findAll('option');
    expect(options.at(-1)!.text()).toBe('Share of top 5 products');

    await wrapper.get('[data-test="filter-metric"]').setValue('topShare');

    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Share of top 5 products, daily');
    expect(wrapper.get('[data-test="chart-svg"]').attributes('aria-label')).toBe(
      'Share of top 5 products over 30 buckets',
    );
    const ticks = wrapper.findAll('[data-test="y-tick"]').map((tick) => tick.text());
    expect(ticks.every((tick) => tick.endsWith('%'))).toBe(true);
    await wrapper.get('[data-test="chart-svg"]').trigger('keydown', { key: 'End' });
    const rows = wrapper.findAll('[data-test^="readout-"]');
    expect(rows).toHaveLength(7);
    expect(rows[0]!.attributes('data-test')).toBe('readout-topShare');
    expect(rows[0]!.find('strong').text()).toMatch(/^\d+\.\d %$/);

    await wrapper.get('[data-test="popular-products"] [data-test="popular-topn"]').setValue('10');
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Share of top 10 products, daily');
  });

  it('the table has a column for the share of the top products', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();

    const headers = wrapper
      .findAll('[data-test="analytics-table"] thead th')
      .map((th) => th.text());

    expect(headers.at(-1)).toBe('Share of top 5 products');
    expect(wrapper.get('[data-test="table-row"]').findAll('td').at(-1)!.text()).toMatch(/ %$/);
  });

  it('the stat tiles compare with the previous period', () => {
    const wrapper = mountInAdmin(AnalyticsView);

    expect(wrapper.get('[data-test="stat-sales-value"]').text()).toMatch(/^€/);
    expect(wrapper.get('[data-test="stat-orders-delta"]').text()).toMatch(/%.*previous period/);
  });
});

describe('LineChart readout', () => {
  it('hovering shows the crosshair and every metric at that bucket, the plotted one first; Escape hides it', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    const svg = wrapper.get('[data-test="chart-svg"]');
    expect(wrapper.find('[data-test="chart-tooltip"]').exists()).toBe(false);

    await svg.trigger('pointermove', { clientX: 700 });

    expect(wrapper.find('[data-test="crosshair"]').exists()).toBe(true);
    const tooltip = wrapper.get('[data-test="chart-tooltip"]');
    const rows = tooltip.findAll('[data-test^="readout-"]');
    expect(rows).toHaveLength(6);
    expect(rows[0]!.attributes('data-test')).toBe('readout-sales');
    expect(rows[0]!.find('strong').text()).toMatch(/^€/);

    await svg.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[data-test="chart-tooltip"]').exists()).toBe(false);
  });

  it('the arrow keys walk the buckets from the keyboard', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    const svg = wrapper.get('[data-test="chart-svg"]');

    await svg.trigger('keydown', { key: 'Home' });
    const first = wrapper.get('[data-test="chart-tooltip"] .chart__tooltip-bucket').text();
    await svg.trigger('keydown', { key: 'ArrowRight' });
    const second = wrapper.get('[data-test="chart-tooltip"] .chart__tooltip-bucket').text();

    expect(first).not.toBe(second);
    expect(svg.attributes('aria-label')).toBe('Sales over 30 buckets');
  });
});

describe('AnalyticsTile', () => {
  it('shows the 30-day sales with a sparkline and links to the page', () => {
    const wrapper = mountInAdmin(AnalyticsTile);

    expect(wrapper.get('[data-test="analytics-tile"]').attributes('href')).toBe('/analytics');
    expect(wrapper.get('[data-test="analytics-tile-value"]').text()).toMatch(/^€/);
    expect(wrapper.get('svg path').attributes('d')).toMatch(/^M/);
  });
});

describe('AnalyticsView and the route query', () => {
  const select = (wrapper: { get: (selector: string) => { element: Element } }, name: string) =>
    (wrapper.get(`[data-test="filter-${name}"]`).element as HTMLSelectElement).value;

  it('opens with the filters of a deep link', async () => {
    const { wrapper } = await mountAtRoute(
      AnalyticsView,
      '/analytics?period=7&granularity=weekly&curve=orders&scale=log&chart=bars',
    );

    expect(
      ['range', 'granularity', 'metric', 'scale', 'chart'].map((n) => select(wrapper, n)),
    ).toEqual(['7', 'weekly', 'orders', 'log', 'bars']);
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Orders, weekly');
  });

  it('opens with a custom period of from and to, shown as its own choice of the period filter', async () => {
    const { wrapper } = await mountAtRoute(
      AnalyticsView,
      '/analytics?from=2026-10-01&to=2026-10-31',
    );

    expect(select(wrapper, 'range')).toBe('custom');
    expect(
      wrapper
        .get('[data-test="filter-range"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toContain('2026-10-01 – 2026-10-31');
    expect(wrapper.findAll('[data-test="table-row"]')).toHaveLength(31);
  });

  it('falls back to the defaults for values that are not allowed', async () => {
    const { wrapper } = await mountAtRoute(
      AnalyticsView,
      '/analytics?period=45&curve=profit&scale=sqrt',
    );

    expect(['range', 'metric', 'scale'].map((n) => select(wrapper, n))).toEqual([
      '30',
      'sales',
      'linear',
    ]);
  });

  it('writes a changed filter to the query, so that the address is a link to this view', async () => {
    const { wrapper, router } = await mountAtRoute(AnalyticsView, '/analytics');

    await wrapper.get('[data-test="filter-range"]').setValue('90');
    await wrapper.get('[data-test="filter-chart"]').setValue('bars');
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({
      period: '90',
      granularity: 'daily',
      curve: 'sales',
      scale: 'linear',
      chart: 'bars',
    });
  });

  it('follows the query when it changes while the page is open (the assistant opens a view)', async () => {
    const { wrapper, router } = await mountAtRoute(AnalyticsView, '/analytics');

    await router.push('/analytics?period=180&curve=customers');
    await flushPromises();

    expect(select(wrapper, 'range')).toBe('180');
    expect(select(wrapper, 'metric')).toBe('customers');
  });

  it('choosing a preset period after a custom one leaves the custom period', async () => {
    const { wrapper, router } = await mountAtRoute(
      AnalyticsView,
      '/analytics?from=2026-10-01&to=2026-10-31',
    );

    await wrapper.get('[data-test="filter-range"]').setValue('7');
    await flushPromises();

    expect(select(wrapper, 'range')).toBe('7');
    expect(router.currentRoute.value.query.from).toBeUndefined();
    expect(router.currentRoute.value.query.period).toBe('7');
  });
});

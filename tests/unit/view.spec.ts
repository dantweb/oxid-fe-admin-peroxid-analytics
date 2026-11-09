import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import AnalyticsTile from '../../src/AnalyticsTile.vue';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { mountInAdmin } from './helpers';

describe('AnalyticsView', () => {
  it('renders the note, the filter row, four tiles, the curve and the table of the last 30 days', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();

    expect(wrapper.get('[data-test="analytics-note"]').text()).toContain('Demo data');
    expect(wrapper.get('[data-test="analytics-note"]').attributes('data-source')).toBe('demo');
    expect(wrapper.get('[data-test="analytics-filters"]').findAll('select')).toHaveLength(4);
    expect(wrapper.findAll('[data-test^="stat-"][data-test$="-value"]')).toHaveLength(4);
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('Sales, daily');
    expect(wrapper.get('[data-test="chart-line"]').attributes('d')).toMatch(/^M.* C/);
    expect(wrapper.findAll('[data-test="table-row"]')).toHaveLength(30);
    expect(wrapper.findAll('[data-test="x-tick"]').length).toBeGreaterThanOrEqual(5);
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
    expect(rows).toHaveLength(5);
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

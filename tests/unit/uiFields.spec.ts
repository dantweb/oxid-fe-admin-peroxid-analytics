import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { analyticsPlugin } from '../../src';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { mountInAdmin } from './helpers';

/**
 * The owner rule "every page and every field reachable by the assistant": every control of the analytics page has a
 * `data-field` id and a descriptor in the plugin's `uiFields`, and no descriptor points at a field that is not there.
 */
const EXPECTED = [
  'analytics.filter.range',
  'analytics.filter.granularity',
  'analytics.filter.metric',
  'analytics.filter.scale',
  'analytics.filter.chartType',
  'analytics.products.topN',
  'analytics.products.measure',
  'analytics.products.chart',
  'analytics.categories.topN',
  'analytics.categories.measure',
  'analytics.categories.chart',
  'analytics.export.chart',
  'analytics.export.table',
  'analytics.export.top_products',
  'analytics.export.top_categories',
];

describe('uiFields of the analytics plugin', () => {
  it('describes each field of the page once, in English and German, on the analytics route', () => {
    const fields = analyticsPlugin.uiFields;

    expect(fields.map((field) => field.id)).toEqual(EXPECTED);
    for (const field of fields) {
      expect(field.route).toBe('/analytics');
      expect(field.right).toBe('ADMIN_ANALYTICS_VIEW');
      for (const text of [field.label, field.help]) {
        expect(text.en.length).toBeGreaterThan(3);
        expect(text.de.length).toBeGreaterThan(3);
        expect(text.de).not.toBe(text.en);
      }
    }
    expect(analyticsPlugin.routes.map((route) => route.path)).toContain('/analytics');
  });

  it('every control on the page carries a data-field id that has a descriptor, and the other way round', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();

    const ids = wrapper.findAll('[data-field]').map((element) => element.attributes('data-field'));
    const controls = wrapper.findAll('select, input, textarea');

    const exportMenus = ids.filter((id) => id?.startsWith('analytics.export.'));
    expect(exportMenus).toHaveLength(4);
    for (const id of exportMenus) {
      expect(wrapper.find(`[data-field="${id}"] button[aria-haspopup="menu"]`).exists()).toBe(true);
    }
    expect(controls).toHaveLength(ids.length - exportMenus.length);
    expect([...ids].sort()).toEqual([...EXPECTED].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(controls.every((control) => control.attributes('data-field'))).toBe(true);
  });
});

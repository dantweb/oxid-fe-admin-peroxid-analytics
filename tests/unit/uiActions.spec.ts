import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { analyticsUiActions, PAGE_CONTROLS, UI_ACTIONS_KEY } from '../../src/uiActions';
import { analyticsUiFields } from '../../src/uiFields';
import { mountInAdmin } from './helpers';

vi.mock('../../src/export/pdf', () => ({
  toPdf: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));
vi.mock('../../src/export/chartImage', async (original) => ({
  ...(await original<typeof import('../../src/export/chartImage')>()),
  svgToPng: vi.fn(async () => ({
    dataUrl: 'data:image/png;base64,AAAA',
    width: 1200,
    height: 600,
  })),
  barsToPng: vi.fn(async () => ({
    dataUrl: 'data:image/png;base64,BBBB',
    width: 900,
    height: 300,
  })),
}));
vi.mock('../../src/export/download', async (original) => ({
  ...(await original<typeof import('../../src/export/download')>()),
  downloadFile: vi.fn(),
}));
const { toPdf } = await import('../../src/export/pdf');
const { svgToPng, barsToPng } = await import('../../src/export/chartImage');
const { downloadFile } = await import('../../src/export/download');

type Handler = (args: Record<string, unknown>) => void | Promise<void>;

function mountPage() {
  const handlers = new Map<string, Handler>();
  const registry = {
    register: (id: string, handler: Handler) => {
      handlers.set(id, handler);
      return () => void handlers.delete(id);
    },
  };
  const wrapper = mountInAdmin(AnalyticsView, {
    global: { provide: { [UI_ACTIONS_KEY]: registry } },
  });
  const run = async (id: string, args: Record<string, unknown>) => {
    await handlers.get(id)!(args);
    await flushPromises();
  };
  return { wrapper, handlers, run };
}

const value = (wrapper: ReturnType<typeof mountPage>['wrapper'], selector: string): string =>
  (wrapper.get(selector).element as HTMLSelectElement).value;
const section = (subject: string) => `[data-test="popular-${subject}"]`;
const control = (subject: string, name: string) =>
  `${section(subject)} [data-test="popular-${name}"]`;
const action = (id: string) => analyticsUiActions.find((entry) => entry.id === id)!;

beforeEach(() => {
  vi.mocked(toPdf).mockClear();
  vi.mocked(downloadFile).mockClear();
  vi.mocked(svgToPng).mockClear();
  vi.mocked(barsToPng).mockClear();
});

describe('the descriptors', () => {
  it('has the two view actions that run at once and the four exports that wait for a click', () => {
    expect(analyticsUiActions.map((entry) => [entry.id, entry.auto])).toEqual([
      ['analytics.show', true],
      ['analytics.popular.show', true],
      ['analytics.export.chart', false],
      ['analytics.export.table', false],
      ['analytics.export.top_products', false],
      ['analytics.export.top_categories', false],
    ]);
  });

  it('analytics.show takes every control of the page', () => {
    expect(action('analytics.show').params).toEqual([
      { name: 'period', type: 'enum', values: ['7', '30', '90', '180'], required: false },
      { name: 'from', type: 'date', required: false },
      { name: 'to', type: 'date', required: false },
      { name: 'granularity', type: 'enum', values: ['daily', 'weekly'], required: false },
      {
        name: 'curve',
        type: 'enum',
        values: [
          'orders',
          'sales',
          'customers',
          'ordersPerCustomer',
          'salesPerCustomer',
          'averageOrder',
          'topShare',
        ],
        required: false,
      },
      { name: 'scale', type: 'enum', values: ['linear', 'log'], required: false },
      { name: 'chart', type: 'enum', values: ['linear', 'curved', 'bars'], required: false },
      { name: 'table', type: 'enum', values: ['open', 'closed'], required: false },
    ]);
  });

  it('analytics.popular.show needs the subject and takes limit, measure and the pie or bars', () => {
    expect(action('analytics.popular.show').params).toEqual([
      { name: 'subject', type: 'enum', values: ['products', 'categories'], required: true },
      { name: 'limit', type: 'int', required: false },
      { name: 'measure', type: 'enum', values: ['sales', 'units', 'orders'], required: false },
      { name: 'chart', type: 'enum', values: ['pie', 'bars'], required: false },
    ]);
  });

  it('the ranking exports take the period and the three choices of their section, the chart export the whole page', () => {
    for (const id of ['analytics.export.top_products', 'analytics.export.top_categories']) {
      expect(action(id).params.map((param) => param.name)).toEqual([
        'format',
        'period',
        'from',
        'to',
        'limit',
        'measure',
        'chart',
      ]);
      expect(action(id).params.find((param) => param.name === 'chart')).toEqual({
        name: 'chart',
        type: 'enum',
        values: ['pie', 'bars'],
        required: false,
      });
    }
    expect(action('analytics.export.chart').params.map((param) => param.name)).toEqual([
      'format',
      ...action('analytics.show').params.map((param) => param.name),
    ]);
  });

  it('every action has a field that the uiFields declare, and the texts in both languages', () => {
    const fieldIds = analyticsUiFields.map((field) => field.id);
    for (const entry of analyticsUiActions) {
      expect(fieldIds, entry.id).toContain(entry.field);
      expect(entry.label.de).not.toBe(entry.label.en);
      expect(entry.help.de).not.toBe(entry.help.en);
    }
    expect(action('analytics.show').field).toBe('analytics.table.toggle');
    expect(action('analytics.popular.show').field).toBe('analytics.popular');
  });
});

describe('the inventory: every control of the page is reachable by an action', () => {
  it('maps each data-field of the page to an action param, or lists it as display-only', () => {
    const { wrapper } = mountPage();

    const ids = wrapper.findAll('[data-field]').map((element) => element.attributes('data-field')!);

    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      expect(PAGE_CONTROLS, `the control ${id} has no entry`).toHaveProperty([id]);
    }
    for (const [id, target] of Object.entries(PAGE_CONTROLS)) {
      expect(ids, `${id} is not on the page`).toContain(id);
      if (target === 'display-only') {
        continue;
      }
      const params = action(target.action).params.map((param) => param.name);
      expect(params, `${id} → ${target.action}`).toContain(target.param);
    }
  });

  it('lists as display-only only the block that the view action scrolls to', () => {
    expect(Object.entries(PAGE_CONTROLS).filter(([, target]) => target === 'display-only')).toEqual(
      [['analytics.popular', 'display-only']],
    );
  });
});

describe('analytics.show', () => {
  it('sets each filter, the chart type and the table, and the page shows exactly that', async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.show', {
      period: '90',
      granularity: 'weekly',
      curve: 'customers',
      scale: 'log',
      chart: 'bars',
      table: 'open',
    });

    expect(
      ['range', 'granularity', 'metric', 'scale', 'chart'].map((n) =>
        value(wrapper, `[data-test="filter-${n}"]`),
      ),
    ).toEqual(['90', 'weekly', 'customers', 'log', 'bars']);
    expect((wrapper.get('[data-test="analytics-table"]').element as HTMLDetailsElement).open).toBe(
      true,
    );
    expect(wrapper.find('[data-test="chart-bars"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="chart-title"]').text()).toBe('New customers, weekly');
  });

  it('sets a custom period and closes the table again', async () => {
    const { wrapper, run } = mountPage();
    await run('analytics.show', { table: 'open' });

    await run('analytics.show', { from: '2026-10-01', to: '2026-10-31', table: 'closed' });

    expect(value(wrapper, '[data-test="filter-range"]')).toBe('custom');
    expect(wrapper.findAll('[data-test="table-row"]')).toHaveLength(31);
    expect((wrapper.get('[data-test="analytics-table"]').element as HTMLDetailsElement).open).toBe(
      false,
    );
  });

  it('sets the share curve and changes nothing it was not asked to change', async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.show', { curve: 'topShare' });

    expect(value(wrapper, '[data-test="filter-metric"]')).toBe('topShare');
    expect(value(wrapper, '[data-test="filter-range"]')).toBe('30');
    expect(value(wrapper, '[data-test="filter-scale"]')).toBe('linear');
  });

  it('writes the new state into the address, so that it is a link to this view', async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.show', { period: '7', table: 'open' });

    expect(wrapper.vm.$route.query).toMatchObject({ period: '7', table: 'open' });
  });
});

describe('analytics.popular.show', () => {
  it('sets the three controls of the products section and leaves the categories alone', async () => {
    const { wrapper, run } = mountPage();
    const scroll = vi.fn();
    wrapper.get(section('products')).element.scrollIntoView = scroll;

    await run('analytics.popular.show', {
      subject: 'products',
      limit: '10',
      measure: 'units',
      chart: 'bars',
    });

    expect([
      value(wrapper, control('products', 'topn')),
      value(wrapper, control('products', 'measure')),
      value(wrapper, control('products', 'chart')),
    ]).toEqual(['10', 'units', 'bars']);
    expect([
      value(wrapper, control('categories', 'topn')),
      value(wrapper, control('categories', 'chart')),
    ]).toEqual(['5', 'pie']);
    expect(wrapper.find(`${section('products')} [data-test="rank-bars"]`).exists()).toBe(true);
    expect(wrapper.findAll(`${section('products')} [data-test="popular-row"]`)).toHaveLength(10);
    expect(scroll).toHaveBeenCalled();
    expect(wrapper.vm.$route.query).toMatchObject({
      pTop: '10',
      pMeasure: 'units',
      pChart: 'bars',
    });
    expect(wrapper.vm.$route.query).not.toHaveProperty('cTop');
  });

  it('sets the categories section: top 3 as bars', async () => {
    const { wrapper, run } = mountPage();
    const scroll = vi.fn();
    wrapper.get(section('categories')).element.scrollIntoView = scroll;

    await run('analytics.popular.show', { subject: 'categories', limit: 3, chart: 'bars' });

    expect([
      value(wrapper, control('categories', 'topn')),
      value(wrapper, control('categories', 'chart')),
    ]).toEqual(['3', 'bars']);
    expect(
      wrapper.findAll(`${section('categories')} [data-test="rank-bar"]`).length,
    ).toBeLessThanOrEqual(4);
    expect(wrapper.vm.$route.query).toMatchObject({ cTop: '3', cChart: 'bars' });
    expect(value(wrapper, '[data-test="filter-chart"]')).toBe('curved'); // the chart of the curve is not touched
    expect(scroll).toHaveBeenCalled();
  });

  it('keeps what it is not given, and refuses a subject it does not know', async () => {
    const { wrapper, run, handlers } = mountPage();
    await run('analytics.popular.show', { subject: 'products', limit: '15' });
    await run('analytics.popular.show', { subject: 'products', measure: 'orders' });

    expect([
      value(wrapper, control('products', 'topn')),
      value(wrapper, control('products', 'measure')),
    ]).toEqual(['15', 'orders']);
    await expect(handlers.get('analytics.popular.show')!({ subject: 'brands' })).rejects.toThrow(
      'subject',
    );
  });
});

describe('the exports set the view first', () => {
  const lastDownload = () => vi.mocked(downloadFile).mock.calls.at(-1)!;

  it("the owner's case: the PDF of the top 3 categories as bars, with the bars image and the legend", async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.export.top_categories', { format: 'pdf', limit: '3', chart: 'bars' });

    expect(value(wrapper, control('categories', 'topn'))).toBe('3');
    expect(value(wrapper, control('categories', 'chart'))).toBe('bars');
    expect(barsToPng).toHaveBeenCalledTimes(1);
    expect(svgToPng).not.toHaveBeenCalled();
    const [table, options] = vi.mocked(toPdf).mock.calls.at(-1)!;
    expect(options.image?.dataUrl).toBe('data:image/png;base64,BBBB');
    expect(options.legend!.length).toBeGreaterThanOrEqual(3);
    expect(options.legend!.length).toBeLessThanOrEqual(4); // 3 categories and Others
    expect(options.legend!.slice(0, 3).map((line) => line.rank)).toEqual(['1', '2', '3']);
    expect(table.rows.length).toBeLessThanOrEqual(4);
    expect(lastDownload()[0]).toMatch(/^analytics-top-categories-sales-.*\.pdf$/);
  });

  it('a products export with measure and pie draws the pie and names the measure in the file', async () => {
    const { run } = mountPage();

    await run('analytics.export.top_products', {
      format: 'csv',
      limit: '10',
      measure: 'units',
      chart: 'pie',
    });

    expect(lastDownload()[0]).toMatch(/^analytics-top-products-units-.*\.csv$/);
    expect(String(lastDownload()[1]).split('\r\n').filter(Boolean)).toHaveLength(1 + 1 + 10 + 1); // demo row, header, 10, others
  });

  it('the chart export takes the whole page state: filters and the open table', async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.export.chart', {
      format: 'csv',
      period: '7',
      granularity: 'weekly',
      curve: 'orders',
      scale: 'log',
      chart: 'bars',
      table: 'open',
    });

    expect(lastDownload()[0]).toMatch(/^analytics-orders-weekly-.*\.csv$/);
    expect(value(wrapper, '[data-test="filter-scale"]')).toBe('log');
    expect(value(wrapper, '[data-test="filter-chart"]')).toBe('bars');
    expect((wrapper.get('[data-test="analytics-table"]').element as HTMLDetailsElement).open).toBe(
      true,
    );
  });

  it('a ranking export does not change the chart type of the curve when it names bars', async () => {
    const { wrapper, run } = mountPage();

    await run('analytics.export.top_products', { format: 'csv', chart: 'bars' });

    expect(value(wrapper, '[data-test="filter-chart"]')).toBe('curved');
    expect(value(wrapper, control('products', 'chart'))).toBe('bars');
  });
});

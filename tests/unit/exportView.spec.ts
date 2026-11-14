import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { analyticsUiActions, UI_ACTIONS_KEY } from '../../src/uiActions';
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
const { downloadFile } = await import('../../src/export/download');
const download = vi.mocked(downloadFile);
const { toPdf } = await import('../../src/export/pdf');
const { svgToPng, barsToPng } = await import('../../src/export/chartImage');

type Handler = (args: Record<string, unknown>) => void | Promise<void>;

function mountExporting(locale = 'en') {
  const handlers = new Map<string, Handler>();
  const unregistered: string[] = [];
  const registry = {
    register: (id: string, handler: Handler) => {
      handlers.set(id, handler);
      return () => void unregistered.push(id);
    },
  };
  const wrapper = mountInAdmin(AnalyticsView, {
    global: { provide: { [UI_ACTIONS_KEY]: registry } },
  });
  wrapper.vm.$i18n.locale = locale;
  return { wrapper, handlers, unregistered };
}

const menu = (wrapper: ReturnType<typeof mountInAdmin>, id: string) =>
  wrapper.get(`[data-field="analytics.export.${id}"]`);
const choose = async (wrapper: ReturnType<typeof mountInAdmin>, id: string, format: string) => {
  await menu(wrapper, id).get('[data-test="export-button"]').trigger('click');
  await menu(wrapper, id).get(`[data-test="export-${format}"]`).trigger('click');
};
const lastDownload = () => {
  const [name, content, type] = download.mock.calls.at(-1)!;
  return { name, content, type };
};
const csvLines = (content: string | Uint8Array): string[] =>
  String(content).replace('﻿', '').split('\r\n').filter(Boolean);
const numberOf = (text: string): number => Number(text.replace(/[^0-9.-]/g, ''));

beforeEach(() => {
  download.mockClear();
  vi.mocked(toPdf).mockClear();
  vi.mocked(svgToPng).mockClear();
  vi.mocked(barsToPng).mockClear();
});

describe('the export menus of the page', () => {
  it('the chart menu offers PDF, XLSX and CSV, the table menu XLSX and CSV, named by what they hold', async () => {
    const { wrapper } = mountExporting();
    await flushPromises();

    for (const id of ['chart', 'table']) {
      await menu(wrapper, id).get('[data-test="export-button"]').trigger('click');
      expect(
        menu(wrapper, id)
          .findAll('[role="menuitem"]')
          .map((item) => item.text()),
      ).toEqual(
        id === 'chart'
          ? ['PDF — chart and table', 'XLSX — data table', 'CSV — data table']
          : ['XLSX — data table', 'CSV — data table'],
      );
      await menu(wrapper, id).get('[role="menu"]').trigger('keydown', { key: 'Escape' });
    }
    expect(menu(wrapper, 'chart').get('button').attributes('aria-label')).toBe(
      'Export chart and data',
    );
    expect(menu(wrapper, 'table').get('button').attributes('aria-label')).toBe('Export table');
  });

  it('each ranking section has its own menu: XLSX and CSV of the ranked list', async () => {
    const { wrapper } = mountExporting();

    await menu(wrapper, 'top_products').get('[data-test="export-button"]').trigger('click');

    expect(
      menu(wrapper, 'top_products')
        .findAll('[role="menuitem"]')
        .map((item) => item.text()),
    ).toEqual(['PDF — chart and ranked list', 'XLSX — ranked list', 'CSV — ranked list']);
    expect(menu(wrapper, 'top_products').get('button').attributes('aria-label')).toBe(
      'Export popular products',
    );
    expect(menu(wrapper, 'top_categories').get('button').attributes('aria-label')).toBe(
      'Export popular categories',
    );
  });

  it('the menus speak German', async () => {
    const { wrapper } = mountExporting('de');
    await flushPromises();

    expect(menu(wrapper, 'chart').get('button').attributes('aria-label')).toBe(
      'Diagramm und Daten exportieren',
    );
    expect(menu(wrapper, 'table').get('button').attributes('aria-label')).toBe(
      'Tabelle exportieren',
    );
  });

  it('exports the table the admin sees: same columns, same rows, same numbers, file named by the filters', async () => {
    const { wrapper } = mountExporting();
    await wrapper.get('[data-test="filter-range"]').setValue('7');
    await wrapper.get('[data-test="filter-metric"]').setValue('customers');

    await choose(wrapper, 'chart', 'csv');

    const { name, content, type } = lastDownload();
    expect(name).toMatch(/^analytics-customers-daily-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(type).toBe('text/csv;charset=utf-8');
    const [demoRow, header, ...rows] = csvLines(content);
    expect(demoRow).toContain('Demo data');
    const visibleHeader = wrapper
      .findAll('[data-test="analytics-table"] thead th')
      .map((th) => th.text());
    expect(header!.split(',').map((label) => label.replace(/ \((EUR|%)\)$/, ''))).toEqual(
      visibleHeader,
    );
    const visibleRows = wrapper.findAll('[data-test="table-row"]');
    expect(rows).toHaveLength(visibleRows.length);
    visibleRows.forEach((row, at) => {
      const exported = rows[at]!.split(',').slice(1).map(Number);
      const shown = row.findAll('td').map((cell) => numberOf(cell.text()));
      shown.forEach((value, column) => expect(exported[column]).toBeCloseTo(value, 1));
    });
  });

  it('the table menu exports the same data as the chart menu, as XLSX bytes', async () => {
    const { wrapper } = mountExporting();

    await choose(wrapper, 'table', 'xlsx');

    const { name, content, type } = lastDownload();
    expect(name).toMatch(/^analytics-sales-daily-.*\.xlsx$/);
    expect(type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(content).toBeInstanceOf(Uint8Array);
    expect(Array.from((content as Uint8Array).slice(0, 2))).toEqual([0x50, 0x4b]); // PK
  });

  it('a German admin gets the semicolon, the decimal comma and German headers in the CSV', async () => {
    const { wrapper } = mountExporting('de');

    await choose(wrapper, 'chart', 'csv');

    const [demoRow, header, first] = csvLines(lastDownload().content);
    expect(demoRow).toContain('Demodaten');
    expect(header).toContain('Bestellungen;Umsatz (EUR)');
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2};\d+;\d+(,\d+)?;/);
  });

  it('exports the ranked list with others, the article number and the shares', async () => {
    const { wrapper } = mountExporting();

    await choose(wrapper, 'top_products', 'csv');

    const { name, content } = lastDownload();
    expect(name).toMatch(/^analytics-top-products-sales-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    const [, header, ...rows] = csvLines(content);
    expect(header).toBe('Rank,Product,Article number,Sales (EUR),Share (%)');
    expect(rows).toHaveLength(6); // 5 + others
    expect(rows.at(-1)).toMatch(/^,Others,,[\d.]+,[\d.]+$/);
    const shares = rows.map((row) => Number(row.split(',').at(-1)));
    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 10)).toBe(1000);
  });

  it('exports the categories without an article number column', async () => {
    const { wrapper } = mountExporting();

    await choose(wrapper, 'top_categories', 'csv');

    expect(csvLines(lastDownload().content)[1]).toBe('Rank,Category,Sales (EUR),Share (%)');
    expect(lastDownload().name).toContain('analytics-top-categories-sales-');
  });
});

describe('the PDF export', () => {
  const pdfCall = () => vi.mocked(toPdf).mock.calls.at(-1)!;

  it('the chart PDF is the chart image and the table, with the period and the footer texts', async () => {
    const { wrapper } = mountExporting();
    await wrapper.get('[data-test="filter-range"]').setValue('7');

    await choose(wrapper, 'chart', 'pdf');
    await flushPromises();

    expect(svgToPng).toHaveBeenCalledTimes(1);
    expect(vi.mocked(svgToPng).mock.calls[0]![0].getAttribute('data-test')).toBe('chart-svg');
    const [table, options] = pdfCall();
    expect(table.title).toBe('Sales, daily');
    expect(table.rows).toHaveLength(7);
    expect(table.meta).toEqual([
      expect.stringMatching(/^Period: \d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}$/),
      'Granularity: Daily',
      'Curve: Sales',
      'Scale: Linear',
      'Source: Demo data',
    ]);
    expect(options.image).toEqual({
      dataUrl: 'data:image/png;base64,AAAA',
      width: 1200,
      height: 600,
    });
    expect(options.created).toMatch(/^Created \d{4}-\d{2}-\d{2} by peroxid-admin analytics$/);
    expect(options.pageOf(2, 5)).toBe('Page 2 of 5');
    expect(options.demoNote).toContain('Demo data');
    const { name, type, content } = lastDownload();
    expect(name).toMatch(/^analytics-sales-daily-.*\.pdf$/);
    expect(type).toBe('application/pdf');
    expect(Array.from(content as Uint8Array)).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('a German PDF has German meta lines and footer', async () => {
    const { wrapper } = mountExporting('de');

    await choose(wrapper, 'chart', 'pdf');
    await flushPromises();

    const [table, options] = pdfCall();
    expect(table.meta[0]).toMatch(/^Zeitraum: /);
    expect(options.created).toMatch(/^Erstellt am \d{4}-\d{2}-\d{2} von peroxid-admin analytics$/);
    expect(options.pageOf(1, 2)).toBe('Seite 1 von 2');
  });

  it('the ranking PDF has the pie as the chart image, or the bars drawn from their colours', async () => {
    const { wrapper } = mountExporting();

    await choose(wrapper, 'top_products', 'pdf');
    await flushPromises();
    expect(vi.mocked(svgToPng).mock.calls.at(-1)![0].getAttribute('data-test')).toBe('pie-svg');
    expect(barsToPng).not.toHaveBeenCalled();
    const pieLegend = pdfCall()[1].legend!;
    expect(pieLegend).toHaveLength(6); // 5 items and Others
    expect(pieLegend.map((line) => line.rank)).toEqual(['1', '2', '3', '4', '5', '']);
    expect(pieLegend.at(-1)).toMatchObject({ title: 'Others' });
    expect(pieLegend[0]!.valueText).toMatch(/^€/);
    expect(pieLegend[0]!.shareText).toMatch(/^\d+\.\d %$/);
    const fills = wrapper
      .findAll('[data-test="popular-products"] [data-test="pie-slice"]')
      .map((el) =>
        /fill: rgb\((\d+), (\d+), (\d+)\)/
          .exec(el.attributes('style') ?? '')!
          .slice(1)
          .map(Number),
      );
    expect(pieLegend.map((line) => line.colour)).toEqual(fills); // the legend shows the colours of the slices
    expect(new Set(pieLegend.map((line) => line.colour.join())).size).toBe(6);
    expect(pdfCall()[0].columns.map((c) => c.label)).toEqual([
      'Rank',
      'Product',
      'Article number',
      'Sales',
      'Share',
    ]);
    expect(lastDownload().name).toMatch(/^analytics-top-products-sales-.*\.pdf$/);

    await wrapper
      .get('[data-test="popular-products"] [data-test="popular-chart"]')
      .setValue('bars');
    await choose(wrapper, 'top_products', 'pdf');
    await flushPromises();
    expect(barsToPng).toHaveBeenCalledTimes(1);
    const rows = vi.mocked(barsToPng).mock.calls[0]![0];
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({ label: 'Others', kind: 'others' });
    expect(pdfCall()[1].image?.dataUrl).toBe('data:image/png;base64,BBBB');
    const barLegend = pdfCall()[1].legend!;
    expect(barLegend.map((line) => line.title)).toEqual(rows.map((row) => row.label));
    expect(barLegend.map((line) => line.rank)).toEqual(['1', '2', '3', '4', '5', '']);
  });

  it('the pdf action exports the chart in the state its args name; the table action refuses a PDF', async () => {
    const { handlers } = mountExporting();

    await handlers.get('analytics.export.chart')!({
      format: 'pdf',
      period: '90',
      granularity: 'weekly',
    });

    expect(lastDownload().name).toMatch(/^analytics-sales-weekly-.*\.pdf$/);
    expect(pdfCall()[0].rows.length).toBeLessThan(15);
    await expect(handlers.get('analytics.export.table')!({ format: 'pdf' })).rejects.toThrow(
      'format',
    );
    await handlers.get('analytics.export.top_categories')!({ format: 'pdf', limit: '3' });
    expect(lastDownload().name).toMatch(/^analytics-top-categories-sales-.*\.pdf$/);
  });
});

describe('the UI actions of the page', () => {
  it('registers the four handlers when the page opens and unregisters them when it closes', () => {
    const { wrapper, handlers, unregistered } = mountExporting();

    expect([...handlers.keys()].sort()).toEqual([
      'analytics.export.chart',
      'analytics.export.table',
      'analytics.export.top_categories',
      'analytics.export.top_products',
    ]);
    wrapper.unmount();
    expect(unregistered.sort()).toEqual([...handlers.keys()].sort());
  });

  it('the chart action applies the filters of its args, then exports in that state', async () => {
    const { handlers } = mountExporting();

    await handlers.get('analytics.export.chart')!({
      format: 'csv',
      from: '2026-10-01',
      to: '2026-10-31',
      granularity: 'weekly',
      curve: 'customers',
    });

    const { name, content } = lastDownload();
    expect(name).toBe('analytics-customers-weekly-2026-10-01_2026-10-31.csv');
    // 2026-10-01 is a Thursday: weeks of Sep 28, Oct 5, 12, 19, 26
    expect(csvLines(content).slice(2)).toHaveLength(5);
  });

  it('the table action exports XLSX of the chosen period', async () => {
    const { handlers } = mountExporting();

    await handlers.get('analytics.export.table')!({ format: 'xlsx', period: '7' });

    expect(lastDownload().name).toMatch(/^analytics-sales-daily-.*\.xlsx$/);
    expect(lastDownload().content).toBeInstanceOf(Uint8Array);
  });

  it('the ranking actions set N and the measure of their section and export that ranking', async () => {
    const { wrapper, handlers } = mountExporting();

    await handlers.get('analytics.export.top_products')!({
      format: 'csv',
      limit: '10',
      measure: 'units',
      from: '2026-10-01',
      to: '2026-10-31',
    });
    await flushPromises();

    expect(lastDownload().name).toBe('analytics-top-products-units-2026-10-01_2026-10-31.csv');
    expect(csvLines(lastDownload().content)).toHaveLength(1 + 1 + 10 + 1); // demo row, header, 10, others
    expect(
      (
        wrapper.get('[data-test="popular-products"] [data-test="popular-topn"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('10');
    expect(
      (
        wrapper.get('[data-test="popular-categories"] [data-test="popular-topn"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('5');
  });

  it('declares the four actions with the contract: field, right and typed params', () => {
    expect(analyticsUiActions.map((action) => action.id)).toEqual([
      'analytics.export.chart',
      'analytics.export.table',
      'analytics.export.top_products',
      'analytics.export.top_categories',
    ]);
    const fieldIds = analyticsUiFields.map((field) => field.id);
    for (const action of analyticsUiActions) {
      expect(action.route).toBe('/analytics');
      expect(action.right).toBe('ADMIN_ANALYTICS_VIEW');
      expect(fieldIds).toContain(action.field);
      expect(action.field).toBe(action.id);
      expect(action.label.de).not.toBe(action.label.en);
      expect(action.help.en.length).toBeGreaterThan(10);
      expect(action.params.find((param) => param.name === 'format')).toEqual({
        name: 'format',
        type: 'enum',
        values: action.id === 'analytics.export.table' ? ['xlsx', 'csv'] : ['pdf', 'xlsx', 'csv'],
        required: true,
      });
    }
    const top = analyticsUiActions[2]!;
    expect(top.params.find((param) => param.name === 'limit')).toEqual({
      name: 'limit',
      type: 'int',
      required: false,
    });
    expect(top.params.find((param) => param.name === 'measure')).toMatchObject({
      type: 'enum',
      values: ['sales', 'units', 'orders'],
    });
    expect(analyticsUiActions[0]!.params.map((param) => param.name)).toEqual([
      'format',
      'period',
      'from',
      'to',
      'granularity',
      'curve',
      'scale',
      'chart',
    ]);
    for (const param of analyticsUiActions[0]!.params.filter(
      (p) => p.name === 'from' || p.name === 'to',
    )) {
      expect(param.type).toBe('date');
    }
  });
});

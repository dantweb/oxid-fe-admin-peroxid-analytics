import { METRICS } from './series/metrics';
import { CHART_KINDS } from './series/curve';
import { RANK_MEASURES } from './series/ranking';
import { POPULAR_CHARTS } from './usePopular';
import { RANGES } from './useAnalytics';
import { SHARE_CURVE } from './series/shareCurve';
import type { UiActionLike, UiActionParamLike } from './types';

/**
 * The page actions of the analytics page for the admin's UI map (`ui-map.json`, `actions`): the admin assistant asks
 * peroxid-admin to run one, `runUiAction(id, args)` opens `/analytics` with the args as the route query, highlights the
 * export button (`field`) and calls the handler that `AnalyticsView` registers under the same id. The export runs in the
 * browser, with the data the page shows. tests/unit/exportView.spec.ts keeps descriptors, fields and handlers in step.
 */
const ROUTE = '/analytics';
const RIGHT = 'ADMIN_ANALYTICS_VIEW';

/** The key under which the admin provides `registerUiAction` (`UI_ACTIONS_KEY` of oxid-fe-admin). */
export const UI_ACTIONS_KEY = 'oxadm:ui-actions';

/** The data files; a PDF (chart image and table) exists for the chart and the rankings, not for the table. */
const FILE_FORMATS = ['xlsx', 'csv'] as const;

const format = (values: readonly string[]): UiActionParamLike => ({
  name: 'format',
  type: 'enum',
  values: [...values],
  required: true,
});
const WITH_PDF = format(['pdf', ...FILE_FORMATS]);
const WITHOUT_PDF = format(FILE_FORMATS);

const optional = (param: Omit<UiActionParamLike, 'required'>): UiActionParamLike => ({
  ...param,
  required: false,
});

const PERIOD_PARAMS: UiActionParamLike[] = [
  optional({ name: 'period', type: 'enum', values: RANGES.map(String) }),
  optional({ name: 'from', type: 'date' }),
  optional({ name: 'to', type: 'date' }),
];

const FILTER_PARAMS: UiActionParamLike[] = [
  ...PERIOD_PARAMS,
  optional({ name: 'granularity', type: 'enum', values: ['daily', 'weekly'] }),
  optional({
    name: 'curve',
    type: 'enum',
    values: [...METRICS.map((metric) => metric.id), SHARE_CURVE],
  }),
  optional({ name: 'scale', type: 'enum', values: ['linear', 'log'] }),
  optional({ name: 'chart', type: 'enum', values: [...CHART_KINDS] }),
];

const TABLE_PARAM = optional({ name: 'table', type: 'enum', values: ['open', 'closed'] });

/** Every control of the page except the ranking sections: the filters and the table. */
const PAGE_PARAMS: UiActionParamLike[] = [...FILTER_PARAMS, TABLE_PARAM];

const LIMIT_PARAM = optional({ name: 'limit', type: 'int' });
const MEASURE_PARAM = optional({ name: 'measure', type: 'enum', values: [...RANK_MEASURES] });
const POPULAR_CHART_PARAM = optional({ name: 'chart', type: 'enum', values: [...POPULAR_CHARTS] });

/** The choices of one ranking section, the same for the view action and the exports. */
const SECTION_PARAMS: UiActionParamLike[] = [LIMIT_PARAM, MEASURE_PARAM, POPULAR_CHART_PARAM];

const RANKING_PARAMS: UiActionParamLike[] = [...PERIOD_PARAMS, ...SECTION_PARAMS];

const action = (
  id: string,
  field: string,
  label: UiActionLike['label'],
  help: UiActionLike['help'],
  params: UiActionParamLike[],
  auto = false,
): UiActionLike => ({ id, label, help, route: ROUTE, right: RIGHT, field, auto, params });

/** An export: the field is its own menu, `format` comes first, and it waits for a click (a download needs one). */
const exportAction = (
  id: string,
  label: UiActionLike['label'],
  help: UiActionLike['help'],
  formatParam: UiActionParamLike,
  params: UiActionParamLike[],
): UiActionLike => action(id, id, label, help, [formatParam, ...params]);

export const analyticsUiActions: UiActionLike[] = [
  action(
    'analytics.show',
    'analytics.table.toggle',
    { en: 'Show the analytics page', de: 'Analytics-Seite anzeigen' },
    {
      en: 'Sets the analytics page: period (period, or from and to), granularity, curve, scale, chart type (chart) and the table (open or closed). It runs at once.',
      de: 'Stellt die Analytics-Seite ein: Zeitraum (period oder from und to), Auflösung, Kurve, Skala, Diagrammtyp (chart) und die Tabelle (open oder closed). Sie läuft sofort.',
    },
    PAGE_PARAMS,
    true,
  ),
  action(
    'analytics.popular.show',
    'analytics.popular',
    { en: 'Show popular products or categories', de: 'Beliebte Produkte oder Kategorien anzeigen' },
    {
      en: 'Sets one ranking section and scrolls to it: subject (products or categories), limit (3, 5, 10, 15 or 20), measure (sales, units, orders) and chart (pie or bars). It runs at once.',
      de: 'Stellt einen Ranglistenabschnitt ein und scrollt dorthin: subject (products oder categories), limit (3, 5, 10, 15 oder 20), measure (sales, units, orders) und chart (pie oder bars). Sie läuft sofort.',
    },
    [
      { name: 'subject', type: 'enum', values: ['products', 'categories'], required: true },
      ...SECTION_PARAMS,
    ],
    true,
  ),
  exportAction(
    'analytics.export.chart',
    { en: 'Export the analytics chart data', de: 'Analytics-Diagrammdaten exportieren' },
    {
      en: 'Downloads the analytics curve as a PDF (chart and table), or its data table as Excel (XLSX) or CSV for the chosen period, granularity and curve.',
      de: 'Lädt die Analytics-Kurve als PDF (Diagramm und Tabelle) oder ihre Datentabelle als Excel (XLSX) oder CSV für den gewählten Zeitraum, die Auflösung und die Kurve herunter.',
    },
    WITH_PDF,
    PAGE_PARAMS,
  ),
  exportAction(
    'analytics.export.table',
    { en: 'Export the analytics table', de: 'Analytics-Tabelle exportieren' },
    {
      en: 'Downloads the analytics table ("Show as table") as Excel (XLSX) or CSV for the chosen period and granularity.',
      de: 'Lädt die Analytics-Tabelle („Als Tabelle zeigen“) als Excel (XLSX) oder CSV für den gewählten Zeitraum und die Auflösung herunter.',
    },
    WITHOUT_PDF,
    PAGE_PARAMS,
  ),
  exportAction(
    'analytics.export.top_products',
    { en: 'Export the popular products', de: 'Beliebte Produkte exportieren' },
    {
      en: 'Downloads the top products with their share of sales (or units, or orders) as a PDF (chart and list), Excel (XLSX) or CSV. limit is 3, 5, 10, 15 or 20.',
      de: 'Lädt die Top-Produkte mit ihrem Anteil am Umsatz (oder an den Stück oder Bestellungen) als PDF (Diagramm und Liste), Excel (XLSX) oder CSV herunter. limit ist 3, 5, 10, 15 oder 20.',
    },
    WITH_PDF,
    RANKING_PARAMS,
  ),
  exportAction(
    'analytics.export.top_categories',
    { en: 'Export the popular categories', de: 'Beliebte Kategorien exportieren' },
    {
      en: 'Downloads the top categories with their share of sales (or units, or orders) as a PDF (chart and list), Excel (XLSX) or CSV. limit is 3, 5, 10, 15 or 20.',
      de: 'Lädt die Top-Kategorien mit ihrem Anteil am Umsatz (oder an den Stück oder Bestellungen) als PDF (Diagramm und Liste), Excel (XLSX) oder CSV herunter. limit ist 3, 5, 10, 15 oder 20.',
    },
    WITH_PDF,
    RANKING_PARAMS,
  ),
];

/**
 * The inventory: each control of the page (its `data-field`) and the action param that sets it. A test holds this
 * table to the page, so a new control without an entry fails. `display-only` is a block that an action scrolls to.
 */
export const PAGE_CONTROLS: Record<string, { action: string; param: string } | 'display-only'> = {
  'analytics.filter.range': { action: 'analytics.show', param: 'period' },
  'analytics.filter.granularity': { action: 'analytics.show', param: 'granularity' },
  'analytics.filter.metric': { action: 'analytics.show', param: 'curve' },
  'analytics.filter.scale': { action: 'analytics.show', param: 'scale' },
  'analytics.filter.chartType': { action: 'analytics.show', param: 'chart' },
  'analytics.table.toggle': { action: 'analytics.show', param: 'table' },
  'analytics.products.topN': { action: 'analytics.popular.show', param: 'limit' },
  'analytics.products.measure': { action: 'analytics.popular.show', param: 'measure' },
  'analytics.products.chart': { action: 'analytics.popular.show', param: 'chart' },
  'analytics.categories.topN': { action: 'analytics.popular.show', param: 'limit' },
  'analytics.categories.measure': { action: 'analytics.popular.show', param: 'measure' },
  'analytics.categories.chart': { action: 'analytics.popular.show', param: 'chart' },
  'analytics.popular': 'display-only',
  'analytics.export.chart': { action: 'analytics.export.chart', param: 'format' },
  'analytics.export.table': { action: 'analytics.export.table', param: 'format' },
  'analytics.export.top_products': { action: 'analytics.export.top_products', param: 'format' },
  'analytics.export.top_categories': { action: 'analytics.export.top_categories', param: 'format' },
};

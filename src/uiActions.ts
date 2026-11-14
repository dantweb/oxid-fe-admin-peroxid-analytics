import { METRICS } from './series/metrics';
import { CHART_KINDS } from './series/curve';
import { RANK_MEASURES } from './series/ranking';
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

const RANKING_PARAMS: UiActionParamLike[] = [
  ...PERIOD_PARAMS,
  optional({ name: 'limit', type: 'int' }),
  optional({ name: 'measure', type: 'enum', values: [...RANK_MEASURES] }),
];

const action = (
  id: string,
  label: UiActionLike['label'],
  help: UiActionLike['help'],
  formatParam: UiActionParamLike,
  params: UiActionParamLike[],
): UiActionLike => ({
  id,
  label,
  help,
  route: ROUTE,
  right: RIGHT,
  field: id,
  params: [formatParam, ...params],
});

export const analyticsUiActions: UiActionLike[] = [
  action(
    'analytics.export.chart',
    { en: 'Export the analytics chart data', de: 'Analytics-Diagrammdaten exportieren' },
    {
      en: 'Downloads the analytics curve as a PDF (chart and table), or its data table as Excel (XLSX) or CSV for the chosen period, granularity and curve.',
      de: 'Lädt die Analytics-Kurve als PDF (Diagramm und Tabelle) oder ihre Datentabelle als Excel (XLSX) oder CSV für den gewählten Zeitraum, die Auflösung und die Kurve herunter.',
    },
    WITH_PDF,
    FILTER_PARAMS,
  ),
  action(
    'analytics.export.table',
    { en: 'Export the analytics table', de: 'Analytics-Tabelle exportieren' },
    {
      en: 'Downloads the analytics table ("Show as table") as Excel (XLSX) or CSV for the chosen period and granularity.',
      de: 'Lädt die Analytics-Tabelle („Als Tabelle zeigen“) als Excel (XLSX) oder CSV für den gewählten Zeitraum und die Auflösung herunter.',
    },
    WITHOUT_PDF,
    FILTER_PARAMS,
  ),
  action(
    'analytics.export.top_products',
    { en: 'Export the popular products', de: 'Beliebte Produkte exportieren' },
    {
      en: 'Downloads the top products with their share of sales (or units, or orders) as a PDF (chart and list), Excel (XLSX) or CSV. limit is 3, 5, 10, 15 or 20.',
      de: 'Lädt die Top-Produkte mit ihrem Anteil am Umsatz (oder an den Stück oder Bestellungen) als PDF (Diagramm und Liste), Excel (XLSX) oder CSV herunter. limit ist 3, 5, 10, 15 oder 20.',
    },
    WITH_PDF,
    RANKING_PARAMS,
  ),
  action(
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

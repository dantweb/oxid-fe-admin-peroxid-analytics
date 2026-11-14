<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ExportMenu from './components/ExportMenu.vue';
import FilterBar from './components/FilterBar.vue';
import LineChart, { type ReadoutRow } from './components/LineChart.vue';
import RankingSection from './components/RankingSection.vue';
import StatTile from './components/StatTile.vue';
import { svgToPng } from './export/chartImage';
import { seriesFileName } from './export/download';
import { exportPdf } from './export/exportPdf';
import { exportTable, type ExportFormat } from './export/exportTable';
import { formatCell, seriesTable, type ColumnKind } from './export/table';
import { dayKey } from './series/buckets';
import { formatBucket } from './series/format';
import { RANK_MEASURES, TOP_N_CHOICES } from './series/ranking';
import { METRICS, metricById, type MetricId, type Unit } from './series/metrics';
import { SHARE_CURVE, SHARE_UNIT, type CurveId } from './series/shareCurve';
import { applyFilters, filtersFromQuery } from './routeFilters';
import { useRouteState } from './routeState';
import { UI_ACTIONS_KEY } from './uiActions';
import { useAnalytics } from './useAnalytics';
import { POPULAR_CHARTS, usePopular, type Popular } from './usePopular';
import { useTopShare } from './useTopShare';

/**
 * The analytics page: one filter row (period, granularity, curve, scale, chart type), five stat tiles for the period,
 * the curve of the chosen metric with a crosshair readout of every metric, and the same numbers as a table.
 * Everything is computed in the browser from the demo data set (src/ecw/demoData.ts), unless the shop's module answers.
 * Below: the popular products and categories of the same period (src/components/RankingSection.vue).
 */
const { t, locale } = useI18n();
const {
  filters,
  series,
  current,
  previous,
  source,
  currency,
  popularContext,
  shareContext,
  settled,
} = useAnalytics();
const products = usePopular('products', popularContext);
const categories = usePopular('categories', popularContext);
const tableOpen = ref(false);
useRouteState(filters, tableOpen, products.state, categories.state);
const share = useTopShare(shareContext, products.state);

const TILES: readonly MetricId[] = [
  'orders',
  'sales',
  'customers',
  'salesPerCustomer',
  'averageOrder',
];

const metricLabel = (id: CurveId): string =>
  id === SHARE_CURVE
    ? t('analytics.metrics.topShare', { n: products.state.topN })
    : t(`analytics.metrics.${id}`);

/** One curve as the chart, the readout and the table know it. */
interface Curve {
  id: CurveId;
  unit: Unit;
  values: number[];
}

/** Every curve of the page: the metrics of the series and the share of the top N products. */
const curves = computed<Curve[]>(() => [
  ...METRICS.map((entry) => ({
    id: entry.id,
    unit: entry.unit,
    values: series.value.values[entry.id],
  })),
  { id: SHARE_CURVE, unit: SHARE_UNIT, values: share.values.value },
]);
const plotted = computed(() => curves.value.find((curve) => curve.id === filters.metric)!);

/** The plotted curve first, then the others — one readout, every series. */
const readout = computed<ReadoutRow[]>(() =>
  [plotted.value, ...curves.value.filter((curve) => curve.id !== plotted.value.id)]
    .filter((curve) => curve.id !== SHARE_CURVE || plotted.value.id === SHARE_CURVE)
    .map((curve) => ({
      id: curve.id,
      label: metricLabel(curve.id),
      values: curve.values,
      unit: curve.unit,
    })),
);

const chartTitle = computed(() =>
  t('analytics.chart.title', {
    metric: metricLabel(filters.metric),
    granularity: t(`analytics.granularity.${filters.granularity}`).toLowerCase(),
  }),
);

const KIND: Record<Unit, Exclude<ColumnKind, 'text'>> = {
  count: 'number',
  currency: 'money',
  ratio: 'ratio',
  percent: 'percent',
};

/** The table model: "Show as table" draws it and the exports write it, so a file holds what the admin sees. */
const table = computed(() =>
  seriesTable({
    title: chartTitle.value,
    demo: source.value === 'demo',
    meta: [],
    bucketLabel: t('analytics.table.bucket'),
    currency: currency.value,
    keys: series.value.keys,
    curves: curves.value.map((curve) => ({
      label: metricLabel(curve.id),
      kind: KIND[curve.unit],
      values: curve.values,
    })),
  }),
);

const tableItems = computed(() => [
  { format: 'xlsx', label: t('analytics.export.xlsxData') },
  { format: 'csv', label: t('analytics.export.csvData') },
]);
/** The chart menu adds the PDF: the chart as an image and the table. */
const chartItems = computed(() => [
  { format: 'pdf', label: t('analytics.export.pdfChart') },
  ...tableItems.value,
]);
const chartCard = ref<HTMLElement | null>(null);

/** The meta lines of a file: what the admin chose, so the file says what it shows. */
const meta = computed(() => {
  const { from, to } = popularContext.range.value;
  const label = (key: string, value: string): string => t(`analytics.export.${key}`, { value });
  return [
    t('analytics.export.period', { from: dayKey(from), to: dayKey(to) }),
    label('granularity', t(`analytics.granularity.${filters.granularity}`)),
    label('curve', metricLabel(filters.metric)),
    label('scale', t(`analytics.scale.${filters.scale}`)),
    label(
      'source',
      t(source.value === 'live' ? 'analytics.export.sourceLive' : 'analytics.export.sourceDemo'),
    ),
  ];
});

async function exportSeriesPdf(): Promise<void> {
  const { from, to } = popularContext.range.value;
  const svg = chartCard.value?.querySelector<SVGSVGElement>('svg.chart__svg') ?? null;
  await exportPdf(
    { ...table.value, meta: meta.value },
    svg === null ? null : await svgToPng(svg),
    seriesFileName(filters.metric, filters.granularity, dayKey(from), dayKey(to), 'pdf'),
    {
      locale: locale.value,
      demoNote: t('analytics.export.demoNote'),
      created: (date) => t('analytics.export.created', { date }),
      pageOf: (page, pages) => t('analytics.export.page', { page, pages }),
    },
  );
}

async function exportSeries(format: ExportFormat): Promise<void> {
  if (format === 'pdf') {
    await exportSeriesPdf();
    return;
  }
  const { from, to } = popularContext.range.value;
  exportTable(
    table.value,
    format,
    (extension) =>
      seriesFileName(filters.metric, filters.granularity, dayKey(from), dayKey(to), extension),
    locale.value,
    t('analytics.export.demoNote'),
  );
}

/* The admin assistant asks the admin to run a page action (`runUiAction`): the page applies the args, waits until the
   data for them is there and exports in that state. The same functions answer the buttons. */
interface UiActionsApi {
  register: (
    id: string,
    handler: (args: Record<string, unknown>) => void | Promise<void>,
  ) => () => void;
}
const uiActions = inject<UiActionsApi | null>(UI_ACTIONS_KEY, null);
const productsSection = ref<InstanceType<typeof RankingSection> | null>(null);
const categoriesSection = ref<InstanceType<typeof RankingSection> | null>(null);

const asQuery = (args: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(args).map(([name, value]) => [name, String(value)]));

/** After the filters changed: let the watchers start their requests, then wait for the answers. */
async function settle(): Promise<void> {
  await nextTick();
  await Promise.all([settled(), share.settled(), products.settled(), categories.settled()]);
  await nextTick();
}

/** The page-level args (the five filters and the table) set the page; what an action does not name stays. */
function applyPage(args: Record<string, unknown>): void {
  applyFilters(filters, filtersFromQuery(asQuery(args)));
  if (args.table === 'open' || args.table === 'closed') {
    tableOpen.value = args.table === 'open';
  }
}

/** The args of a ranking section (`limit`, `measure`, `chart`); what an action does not name stays. */
function applySection(popular: Popular, args: Record<string, unknown>): void {
  popular.state.topN =
    TOP_N_CHOICES.find((n) => String(n) === String(args.limit)) ?? popular.state.topN;
  popular.state.measure = RANK_MEASURES.find((m) => m === args.measure) ?? popular.state.measure;
  popular.state.chart = POPULAR_CHARTS.find((c) => c === args.chart) ?? popular.state.chart;
}

/** The view action `analytics.show`: the page is set, nothing is exported. */
async function runShowAction(args: Record<string, unknown>): Promise<void> {
  applyPage(args);
  await settle();
}

async function runSeriesAction(args: Record<string, unknown>): Promise<void> {
  applyPage(args);
  await settle();
  await exportSeries(args.format as ExportFormat);
}

/** The table has no chart image: the admin's PDF action is for the chart, the ranking sections and nothing else. */
async function runTableAction(args: Record<string, unknown>): Promise<void> {
  if (args.format === 'pdf') {
    throw new Error('format: the table is exported as xlsx or csv');
  }
  await runSeriesAction(args);
}

type Subject = 'products' | 'categories';
const isSubject = (value: unknown): value is Subject =>
  value === 'products' || value === 'categories';

/** The period of an action (`period`, or `from` and `to`) sets the page period; the section args set the section. */
function applyRanking(subject: Subject, args: Record<string, unknown>): void {
  const period = filtersFromQuery(asQuery(args));
  applyFilters(filters, {
    ...(period.rangeDays === undefined ? {} : { rangeDays: period.rangeDays }),
    ...(period.from === undefined ? {} : { from: period.from, to: period.to }),
  });
  applySection(subject === 'products' ? products : categories, args);
}

/** The view action `analytics.popular.show`: one section is set and scrolled into view. */
async function runPopularShowAction(args: Record<string, unknown>): Promise<void> {
  if (!isSubject(args.subject)) {
    throw new Error('subject: products or categories');
  }
  applyRanking(args.subject, args);
  await settle();
  const section = args.subject === 'products' ? productsSection : categoriesSection;
  (section.value?.$el as HTMLElement | undefined)?.scrollIntoView?.({
    block: 'start',
    behavior: 'smooth',
  });
}

async function runRankingAction(subject: Subject, args: Record<string, unknown>): Promise<void> {
  applyRanking(subject, args);
  await settle();
  const section = subject === 'products' ? productsSection : categoriesSection;
  await section.value?.exportAs(args.format as ExportFormat);
}

const unregister: (() => void)[] = [];
onMounted(() => {
  unregister.push(
    ...(uiActions === null
      ? []
      : [
          uiActions.register('analytics.show', runShowAction),
          uiActions.register('analytics.popular.show', runPopularShowAction),
          uiActions.register('analytics.export.chart', runSeriesAction),
          uiActions.register('analytics.export.table', runTableAction),
          uiActions.register('analytics.export.top_products', (args) =>
            runRankingAction('products', args),
          ),
          uiActions.register('analytics.export.top_categories', (args) =>
            runRankingAction('categories', args),
          ),
        ]),
  );
});
onBeforeUnmount(() => unregister.splice(0).forEach((remove) => remove()));
</script>

<template>
  <section class="page--flat analytics" data-test="analytics">
    <h1>{{ t('analytics.title') }}</h1>
    <p class="analytics__note" data-test="analytics-note" :data-source="source">
      {{ t(source === 'live' ? 'analytics.liveNote' : 'analytics.demoNote') }}
    </p>
    <FilterBar v-model="filters" :top-n="products.state.topN" />
    <div class="analytics__stats analytics-row fold-grid" data-test="analytics-stats">
      <StatTile
        v-for="id in TILES"
        :id="id"
        :key="id"
        :label="metricLabel(id)"
        :value="current[id]"
        :previous="previous[id]"
        :unit="metricById(id).unit"
      />
    </div>
    <div ref="chartCard" class="analytics__card fold-pane-b" data-test="analytics-chart-card">
      <div class="analytics__head">
        <h2 data-test="chart-title">{{ chartTitle }}</h2>
        <ExportMenu
          :label="t('analytics.export.chart')"
          :items="chartItems"
          field-id="analytics.export.chart"
          @select="void exportSeries($event as ExportFormat)"
        />
      </div>
      <p v-if="filters.scale === 'log'" class="analytics__note" data-test="log-note">
        {{ t('analytics.chart.logNote') }}
      </p>
      <LineChart
        :keys="series.keys"
        :values="plotted.values"
        :scale="filters.scale"
        :chart="filters.chart"
        :unit="plotted.unit"
        :granularity="filters.granularity"
        :name="metricLabel(filters.metric)"
        :readout="readout"
      />
      <div class="analytics__table-bar">
        <details
          class="analytics__table"
          data-test="analytics-table"
          :open="tableOpen"
          @toggle="tableOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary data-field="analytics.table.toggle">{{ t('analytics.table.show') }}</summary>
          <div
            class="table-scroll"
            tabindex="0"
            role="region"
            :aria-label="t('analytics.table.region')"
          >
            <table>
              <thead>
                <tr>
                  <th v-for="column in table.columns" :key="column.label" scope="col">
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in table.rows" :key="String(row[0])" data-test="table-row">
                  <th scope="row">
                    {{ formatBucket(String(row[0]), filters.granularity, locale) }}
                  </th>
                  <td v-for="(cell, at) in row.slice(1)" :key="at" class="analytics__number">
                    {{ formatCell(cell, table.columns[at + 1]!, locale) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        <div class="analytics__table-export">
          <ExportMenu
            :label="t('analytics.export.table')"
            :items="tableItems"
            field-id="analytics.export.table"
            @select="void exportSeries($event as ExportFormat)"
          />
        </div>
      </div>
    </div>
    <div class="analytics__popular" data-field="analytics.popular" data-test="analytics-popular">
      <RankingSection ref="productsSection" subject="products" :popular="products" />
      <RankingSection ref="categoriesSection" subject="categories" :popular="categories" />
    </div>
  </section>
</template>

<style scoped>
.analytics__note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--oxfe-color-text-muted, #666666);
}
.analytics {
  /* one grid for the page: its width is the width of the content, which changes when the admin's sidebar is open or
     folded, so the steps below follow this container and not the viewport */
  container: analytics / inline-size;
  --analytics-gap: 1rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--analytics-gap);
}
/* the filter row and the stat row: the same columns, so filter n and tile n have the same edges at every width */
.analytics-row {
  display: grid;
  grid-template-columns: repeat(var(--analytics-columns, 1), minmax(0, 1fr));
  gap: var(--analytics-gap);
}
.analytics-row > * {
  min-width: 0;
}
@container analytics (min-width: 26rem) {
  .analytics-row {
    --analytics-columns: 2;
  }
}
@container analytics (min-width: 40rem) {
  .analytics-row {
    --analytics-columns: 3;
  }
}
@container analytics (min-width: 64rem) {
  .analytics-row {
    --analytics-columns: 5;
  }
}
.analytics__card {
  min-width: 0; /* a grid item may shrink below its widest table: the table scrolls inside its box */
  padding: 1.5rem;
  background: var(--oxfe-color-surface, #ffffff);
  border-radius: var(--oxfe-radius-lg, 8px);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 6%),
    0 1px 3px rgb(0 0 0 / 8%);
}
.analytics__popular {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--analytics-gap);
  align-items: start;
}
@container analytics (min-width: 48rem) {
  .analytics__popular {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.analytics__card > h2 {
  margin-top: 0;
}
.analytics__card > * + * {
  margin-top: 1rem;
}
.analytics__head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}
.analytics__head > h2 {
  margin: 0;
}
.analytics__table-bar {
  position: relative;
  min-width: 0;
}
.analytics__table-export {
  position: absolute;
  top: -0.35rem;
  right: 0;
}
.analytics__table summary {
  cursor: pointer;
  color: var(--oxfe-color-link, #2471a3);
}
.analytics__table .table-scroll {
  margin-top: 0.75rem;
}
.analytics__number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>

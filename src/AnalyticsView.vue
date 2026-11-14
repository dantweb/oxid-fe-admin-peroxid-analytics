<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterBar from './components/FilterBar.vue';
import LineChart, { type ReadoutRow } from './components/LineChart.vue';
import RankingSection from './components/RankingSection.vue';
import StatTile from './components/StatTile.vue';
import { formatBucket, formatValue } from './series/format';
import { METRICS, metricById, type MetricId, type Unit } from './series/metrics';
import { SHARE_CURVE, SHARE_UNIT, type CurveId } from './series/shareCurve';
import { useRouteFilters } from './routeFilters';
import { useAnalytics } from './useAnalytics';
import { usePopular } from './usePopular';
import { useTopShare } from './useTopShare';

/**
 * The analytics page: one filter row (period, granularity, curve, scale, chart type), five stat tiles for the period,
 * the curve of the chosen metric with a crosshair readout of every metric, and the same numbers as a table.
 * Everything is computed in the browser from the demo data set (src/ecw/demoData.ts), unless the shop's module answers.
 * Below: the popular products and categories of the same period (src/components/RankingSection.vue).
 */
const { t, locale } = useI18n();
const { filters, series, current, previous, source, popularContext, shareContext } = useAnalytics();
useRouteFilters(filters);
const products = usePopular('products', popularContext);
const categories = usePopular('categories', popularContext);
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
</script>

<template>
  <section class="page--flat analytics" data-test="analytics">
    <h1>{{ t('analytics.title') }}</h1>
    <p class="analytics__note" data-test="analytics-note" :data-source="source">
      {{ t(source === 'live' ? 'analytics.liveNote' : 'analytics.demoNote') }}
    </p>
    <FilterBar v-model="filters" :top-n="products.state.topN" />
    <div class="analytics__stats fold-grid" data-test="analytics-stats">
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
    <div class="analytics__card fold-pane-b" data-test="analytics-chart-card">
      <h2 data-test="chart-title">{{ chartTitle }}</h2>
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
      <details class="analytics__table" data-test="analytics-table">
        <summary>{{ t('analytics.table.show') }}</summary>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{{ t('analytics.table.bucket') }}</th>
                <th v-for="curve in curves" :key="curve.id" scope="col">
                  {{ metricLabel(curve.id) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(key, at) in series.keys" :key="key" data-test="table-row">
                <th scope="row">{{ formatBucket(key, filters.granularity, locale) }}</th>
                <td v-for="curve in curves" :key="curve.id" class="analytics__number">
                  {{ formatValue(curve.values[at] ?? 0, curve.unit, locale) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
    <div class="analytics__popular" data-test="analytics-popular">
      <RankingSection subject="products" :popular="products" />
      <RankingSection subject="categories" :popular="categories" />
    </div>
  </section>
</template>

<style scoped>
.analytics__note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--oxfe-color-text-muted, #666666);
}
.analytics__stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 1rem;
}
.analytics__card {
  padding: 1.5rem;
  background: var(--oxfe-color-surface, #ffffff);
  border-radius: var(--oxfe-radius-lg, 8px);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 6%),
    0 1px 3px rgb(0 0 0 / 8%);
}
.analytics__popular {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 30rem), 1fr));
  gap: 1rem;
  align-items: start;
}
.analytics__card > h2 {
  margin-top: 0;
}
.analytics__card > * + * {
  margin-top: 1rem;
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

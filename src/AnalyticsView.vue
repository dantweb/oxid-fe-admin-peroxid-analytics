<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FilterBar from './components/FilterBar.vue';
import LineChart, { type ReadoutRow } from './components/LineChart.vue';
import StatTile from './components/StatTile.vue';
import { formatBucket, formatValue } from './series/format';
import { METRICS, metricById, type MetricId } from './series/metrics';
import { useAnalytics } from './useAnalytics';

/**
 * The analytics page: one filter row (period, granularity, curve, scale), four stat tiles for the period,
 * the curve of the chosen metric with a crosshair readout of every metric, and the same numbers as a table.
 * Everything is computed in the browser from the demo data set (src/ecw/demoData.ts).
 */
const { t, locale } = useI18n();
const { filters, series, current, previous, source } = useAnalytics();

const TILES: readonly MetricId[] = ['orders', 'sales', 'customers', 'salesPerCustomer'];

const metric = computed(() => metricById(filters.metric));
const metricLabel = (id: MetricId): string => t(`analytics.metrics.${id}`);

/** The plotted metric first, then the others — one readout, every series. */
const readout = computed<ReadoutRow[]>(() =>
  [metric.value, ...METRICS.filter((entry) => entry.id !== metric.value.id)].map((entry) => ({
    id: entry.id,
    label: metricLabel(entry.id),
    values: series.value.values[entry.id],
    unit: entry.unit,
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
    <FilterBar v-model="filters" />
    <div class="analytics__stats" data-test="analytics-stats">
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
    <div class="analytics__card">
      <h2 data-test="chart-title">{{ chartTitle }}</h2>
      <p v-if="filters.scale === 'log'" class="analytics__note" data-test="log-note">
        {{ t('analytics.chart.logNote') }}
      </p>
      <LineChart
        :keys="series.keys"
        :values="series.values[filters.metric]"
        :scale="filters.scale"
        :unit="metric.unit"
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
                <th v-for="entry in METRICS" :key="entry.id" scope="col">
                  {{ metricLabel(entry.id) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(key, at) in series.keys" :key="key" data-test="table-row">
                <th scope="row">{{ formatBucket(key, filters.granularity, locale) }}</th>
                <td v-for="entry in METRICS" :key="entry.id" class="analytics__number">
                  {{ formatValue(series.values[entry.id][at] ?? 0, entry.unit, locale) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
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

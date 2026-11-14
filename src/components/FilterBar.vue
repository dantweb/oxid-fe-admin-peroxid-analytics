<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CHART_KINDS } from '../series/curve';
import { METRICS } from '../series/metrics';
import { SHARE_CURVE } from '../series/shareCurve';
import { RANGES, type AnalyticsFilters, type RangeDays } from '../useAnalytics';

/** One row above the charts, period first; every chart and tile below follows the same slice. */
const filters = defineModel<AnalyticsFilters>({ required: true });
defineProps<{ topN: number }>();
const { t } = useI18n();

/** `custom` while the period is a from-to range (from a link or the assistant), else the number of days. */
const CUSTOM = 'custom';
const periodChoice = computed(() =>
  filters.value.from === '' ? String(filters.value.rangeDays) : CUSTOM,
);
function choosePeriod(value: string): void {
  if (value === CUSTOM) {
    return;
  }
  filters.value.rangeDays = Number(value) as RangeDays;
  filters.value.from = '';
  filters.value.to = '';
}
</script>

<template>
  <form
    class="analytics-filters analytics-row fold-grid"
    data-test="analytics-filters"
    @submit.prevent
  >
    <label>
      {{ t('analytics.filters.range') }}
      <select
        :value="periodChoice"
        data-field="analytics.filter.range"
        data-test="filter-range"
        @change="choosePeriod(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="days in RANGES" :key="days" :value="days">
          {{ t(`analytics.range.d${days}`) }}
        </option>
        <option v-if="periodChoice === CUSTOM" :value="CUSTOM">
          {{ filters.from }} – {{ filters.to }}
        </option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.granularity') }}
      <select
        v-model="filters.granularity"
        data-field="analytics.filter.granularity"
        data-test="filter-granularity"
      >
        <option value="daily">{{ t('analytics.granularity.daily') }}</option>
        <option value="weekly">{{ t('analytics.granularity.weekly') }}</option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.metric') }}
      <select
        v-model="filters.metric"
        data-field="analytics.filter.metric"
        data-test="filter-metric"
      >
        <option v-for="metric in METRICS" :key="metric.id" :value="metric.id">
          {{ t(`analytics.metrics.${metric.id}`) }}
        </option>
        <option :value="SHARE_CURVE">{{ t('analytics.metrics.topShare', { n: topN }) }}</option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.scale') }}
      <select v-model="filters.scale" data-field="analytics.filter.scale" data-test="filter-scale">
        <option value="linear">{{ t('analytics.scale.linear') }}</option>
        <option value="log">{{ t('analytics.scale.log') }}</option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.chartType') }}
      <select
        v-model="filters.chart"
        data-field="analytics.filter.chartType"
        data-test="filter-chart"
      >
        <option v-for="kind in CHART_KINDS" :key="kind" :value="kind">
          {{ t(`analytics.chartType.${kind}`) }}
        </option>
      </select>
    </label>
  </form>
</template>

<style scoped>
/* the grid (`.analytics-row`) is the page's; a control fills its column */
label {
  min-width: 0;
}
select {
  width: 100%;
  min-width: 0;
}
</style>

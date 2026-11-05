<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { METRICS } from '../series/metrics';
import { RANGES, type AnalyticsFilters } from '../useAnalytics';

/** One row above the charts, period first; every chart and tile below follows the same slice. */
const filters = defineModel<AnalyticsFilters>({ required: true });
const { t } = useI18n();
</script>

<template>
  <form class="analytics-filters" data-test="analytics-filters" @submit.prevent>
    <label>
      {{ t('analytics.filters.range') }}
      <select v-model.number="filters.rangeDays" data-test="filter-range">
        <option v-for="days in RANGES" :key="days" :value="days">
          {{ t(`analytics.range.d${days}`) }}
        </option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.granularity') }}
      <select v-model="filters.granularity" data-test="filter-granularity">
        <option value="daily">{{ t('analytics.granularity.daily') }}</option>
        <option value="weekly">{{ t('analytics.granularity.weekly') }}</option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.metric') }}
      <select v-model="filters.metric" data-test="filter-metric">
        <option v-for="metric in METRICS" :key="metric.id" :value="metric.id">
          {{ t(`analytics.metrics.${metric.id}`) }}
        </option>
      </select>
    </label>
    <label>
      {{ t('analytics.filters.scale') }}
      <select v-model="filters.scale" data-test="filter-scale">
        <option value="linear">{{ t('analytics.scale.linear') }}</option>
        <option value="log">{{ t('analytics.scale.log') }}</option>
      </select>
    </label>
  </form>
</template>

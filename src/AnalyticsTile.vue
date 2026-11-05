<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { smoothPath } from './series/curve';
import { formatValue } from './series/format';
import { createYScale, xPositions } from './series/scale';
import { useAnalytics } from './useAnalytics';

/** The dashboard tile: sales of the last 30 days with a 12-point sparkline, linking to the page. */
const { t, locale } = useI18n();
const { series, current } = useAnalytics();

const SPARK = { width: 160, height: 40, points: 12 } as const;
const spark = computed(() => {
  const values = series.value.values.sales.slice(-SPARK.points);
  const scale = createYScale({ values, kind: 'linear', top: 4, bottom: SPARK.height - 4 });
  const xs = xPositions(values.length, 4, SPARK.width - 4);
  return smoothPath(xs.map((x, at) => ({ x, y: scale.y(values[at] ?? 0) })));
});
const sales = computed(() => formatValue(current.value.sales, 'currency', locale.value, true));
</script>

<template>
  <RouterLink to="/analytics" class="analytics-tile" data-test="analytics-tile">
    <span class="analytics-tile__label">{{ t('analytics.tile.title') }}</span>
    <strong class="analytics-tile__value" data-test="analytics-tile-value">{{ sales }}</strong>
    <svg
      :viewBox="`0 0 ${SPARK.width} ${SPARK.height}`"
      :width="SPARK.width"
      :height="SPARK.height"
      class="analytics-tile__spark"
      aria-hidden="true"
    >
      <path :d="spark" />
    </svg>
    <span class="analytics-tile__open">{{ t('analytics.tile.open') }} →</span>
  </RouterLink>
</template>

<style scoped>
.analytics-tile {
  display: grid;
  gap: 0.5rem;
  max-width: 20rem;
  padding: 1.25rem;
  color: var(--oxfe-color-text, #333333);
  text-decoration: none;
  background: var(--oxfe-color-surface, #ffffff);
  border: 1px solid transparent;
  border-radius: var(--oxfe-radius-lg, 8px);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 6%),
    0 1px 3px rgb(0 0 0 / 8%);
}
.analytics-tile:hover {
  text-decoration: none;
  border-color: var(--oxfe-color-primary, #2471a3);
}
.analytics-tile__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--oxfe-color-text-muted, #666666);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.analytics-tile__value {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.1;
}
.analytics-tile__spark path {
  fill: none;
  stroke: var(--oxfe-color-primary, #2471a3);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.analytics-tile__open {
  font-size: 0.875rem;
  color: var(--oxfe-color-link, #2471a3);
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatPercent, formatValue, percentChange } from '../series/format';
import type { Unit } from '../series/metrics';

/** A stat tile: label, the value in full, the change against the previous period (up is good here). */
const props = defineProps<{
  id: string;
  label: string;
  value: number;
  previous: number;
  unit: Unit;
}>();
const { t, locale } = useI18n();
const text = computed(() => formatValue(props.value, props.unit, locale.value));
const change = computed(() => percentChange(props.value, props.previous));
const direction = computed(() =>
  change.value === null ? 'none' : change.value >= 0 ? 'up' : 'down',
);
</script>

<template>
  <div class="stat" :data-test="`stat-${id}`">
    <span class="stat__label">{{ label }}</span>
    <strong class="stat__value" :data-test="`stat-${id}-value`">{{ text }}</strong>
    <span class="stat__delta" :class="`stat__delta--${direction}`" :data-test="`stat-${id}-delta`">
      <template v-if="change !== null">
        {{ formatPercent(change, locale) }} {{ t('analytics.tiles.delta') }}
      </template>
      <template v-else>{{ t('analytics.tiles.noDelta') }}</template>
    </span>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.25rem;
  color: var(--oxfe-color-text, #333333);
  background: var(--oxfe-color-surface, #ffffff);
  border-radius: var(--oxfe-radius-lg, 8px);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 6%),
    0 1px 3px rgb(0 0 0 / 8%);
}
.stat__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--oxfe-color-text-muted, #666666);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.stat__value {
  font-size: 1.875rem;
  font-weight: 600;
  line-height: 1.1;
}
.stat__delta {
  font-size: 0.8125rem;
  color: var(--oxfe-color-text-muted, #666666);
}
.stat__delta--up::before {
  content: '▲ ';
  color: var(--oxfe-color-primary, #2471a3);
}
.stat__delta--down::before {
  content: '▼ ';
  color: var(--oxfe-color-danger, #c0392b);
}
</style>

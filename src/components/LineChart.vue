<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Granularity } from '../series/buckets';
import { areaPath, smoothPath, type Point } from '../series/curve';
import { formatBucket, formatValue } from '../series/format';
import type { Unit } from '../series/metrics';
import { createYScale, xPositions, type ScaleKind } from '../series/scale';

/** One row of the readout at the hovered X: every metric, the plotted one first. */
export interface ReadoutRow {
  id: string;
  label: string;
  values: readonly number[];
  unit: Unit;
}

const props = defineProps<{
  keys: readonly string[];
  values: readonly number[];
  scale: ScaleKind;
  unit: Unit;
  granularity: Granularity;
  name: string;
  readout: readonly ReadoutRow[];
}>();

const { t, locale } = useI18n();

const HEIGHT = 280;
const MARGIN = { top: 16, right: 72, bottom: 28, left: 60 } as const;
const DEFAULT_WIDTH = 720;

const wrapper = ref<HTMLElement | null>(null);
const width = ref(DEFAULT_WIDTH);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || wrapper.value === null) {
    return;
  }
  observer = new ResizeObserver((entries) => {
    const measured = entries[0]?.contentRect.width ?? DEFAULT_WIDTH;
    width.value = Math.max(320, Math.round(measured));
  });
  observer.observe(wrapper.value);
});
onBeforeUnmount(() => observer?.disconnect());

const plotLeft = MARGIN.left;
const plotRight = computed(() => width.value - MARGIN.right);
const plotTop = MARGIN.top;
const plotBottom = HEIGHT - MARGIN.bottom;

const yScale = computed(() =>
  createYScale({ values: props.values, kind: props.scale, top: plotTop, bottom: plotBottom }),
);
const xs = computed(() => xPositions(props.values.length, plotLeft, plotRight.value));
const points = computed<Point[]>(() =>
  xs.value.map((x, at) => ({ x, y: yScale.value.y(props.values[at] ?? 0) })),
);
const linePath = computed(() => smoothPath(points.value));
const wash = computed(() => areaPath(points.value, plotBottom));
const last = computed(() => points.value[points.value.length - 1] ?? null);
const lastValue = computed(() => props.values[props.values.length - 1] ?? 0);

/** About six x labels, always the first and the last bucket. */
const xTicks = computed(() => {
  const count = props.keys.length;
  if (count === 0) {
    return [];
  }
  const step = Math.max(1, Math.ceil(count / 6));
  const indices = new Set<number>();
  for (let at = 0; at < count; at += step) {
    indices.add(at);
  }
  indices.add(count - 1);
  return [...indices].map((at) => ({
    at,
    x: xs.value[at]!,
    label: formatBucket(props.keys[at]!, props.granularity, locale.value),
  }));
});

const hovered = ref<number | null>(null);

function nearestIndex(clientX: number): number | null {
  const element = wrapper.value;
  if (element === null || xs.value.length === 0) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const scale = rect.width > 0 ? width.value / rect.width : 1;
  const x = (clientX - rect.left) * scale;
  let best = 0;
  for (let at = 1; at < xs.value.length; at += 1) {
    if (Math.abs(xs.value[at]! - x) < Math.abs(xs.value[best]! - x)) {
      best = at;
    }
  }
  return best;
}

const onPointerMove = (event: PointerEvent): void => {
  hovered.value = nearestIndex(event.clientX);
};
const onLeave = (): void => {
  hovered.value = null;
};
const onKey = (event: KeyboardEvent): void => {
  const count = xs.value.length;
  if (count === 0) {
    return;
  }
  const current = hovered.value ?? count - 1;
  const next: Record<string, number | null> = {
    ArrowLeft: Math.max(0, current - 1),
    ArrowRight: Math.min(count - 1, current + 1),
    Home: 0,
    End: count - 1,
    Escape: null,
  };
  if (event.key in next) {
    event.preventDefault();
    hovered.value = next[event.key] ?? null;
  }
};

const tooltip = computed(() => {
  const at = hovered.value;
  if (at === null || at >= props.keys.length) {
    return null;
  }
  const x = xs.value[at]!;
  // the readout sits right of the crosshair, left of it near the right edge
  const flip = x > width.value * 0.65;
  return {
    at,
    x,
    y: points.value[at]!.y,
    left: flip ? null : x + 12,
    right: flip ? width.value - x + 12 : null,
    bucket: formatBucket(props.keys[at]!, props.granularity, locale.value),
    rows: props.readout.map((row) => ({
      id: row.id,
      label: row.label,
      text: formatValue(row.values[at] ?? 0, row.unit, locale.value),
    })),
  };
});

const tooltipStyle = computed(() =>
  tooltip.value === null
    ? {}
    : tooltip.value.left !== null
      ? { left: `${(tooltip.value.left / width.value) * 100}%` }
      : { right: `${(tooltip.value.right! / width.value) * 100}%` },
);

const ariaLabel = computed(() =>
  t('analytics.chart.ariaLabel', { metric: props.name, count: props.keys.length }),
);
</script>

<template>
  <div ref="wrapper" class="chart" data-test="line-chart">
    <svg
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      :width="width"
      :height="HEIGHT"
      class="chart__svg"
      role="img"
      :aria-label="ariaLabel"
      tabindex="0"
      data-test="chart-svg"
      @pointermove="onPointerMove"
      @pointerleave="onLeave"
      @keydown="onKey"
      @blur="onLeave"
    >
      <g class="chart__grid" aria-hidden="true">
        <line
          v-for="tick in yScale.ticks"
          :key="tick.value"
          :x1="plotLeft"
          :x2="plotRight"
          :y1="tick.y"
          :y2="tick.y"
          class="chart__gridline"
        />
      </g>
      <g class="chart__axis" aria-hidden="true">
        <text
          v-for="tick in yScale.ticks"
          :key="tick.value"
          :x="plotLeft - 8"
          :y="tick.y + 4"
          text-anchor="end"
          class="chart__tick"
          data-test="y-tick"
        >
          {{ formatValue(tick.value, unit, locale, true) }}
        </text>
        <text
          v-for="tick in xTicks"
          :key="tick.at"
          :x="tick.x"
          :y="plotBottom + 18"
          text-anchor="middle"
          class="chart__tick"
          data-test="x-tick"
        >
          {{ tick.label }}
        </text>
      </g>
      <path v-if="wash" :d="wash" class="chart__wash" aria-hidden="true" />
      <path :d="linePath" class="chart__line" data-test="chart-line" />
      <g v-if="last" aria-hidden="true">
        <circle :cx="last.x" :cy="last.y" r="6" class="chart__ring" />
        <circle :cx="last.x" :cy="last.y" r="4" class="chart__marker" />
        <text :x="last.x + 10" :y="last.y + 4" class="chart__end-label" data-test="end-label">
          {{ formatValue(lastValue, unit, locale, true) }}
        </text>
      </g>
      <g v-if="tooltip" aria-hidden="true" data-test="crosshair">
        <line
          :x1="tooltip.x"
          :x2="tooltip.x"
          :y1="plotTop"
          :y2="plotBottom"
          class="chart__crosshair"
        />
        <circle :cx="tooltip.x" :cy="tooltip.y" r="6" class="chart__ring" />
        <circle :cx="tooltip.x" :cy="tooltip.y" r="4" class="chart__marker" />
      </g>
    </svg>
    <div
      v-if="tooltip"
      class="chart__tooltip"
      :style="tooltipStyle"
      role="status"
      data-test="chart-tooltip"
    >
      <span class="chart__tooltip-bucket">{{ tooltip.bucket }}</span>
      <div
        v-for="row in tooltip.rows"
        :key="row.id"
        class="chart__row"
        :data-test="`readout-${row.id}`"
      >
        <span class="chart__key" :class="{ 'chart__key--plotted': row.id === readout[0]?.id }" />
        <strong>{{ row.text }}</strong>
        <span class="chart__row-label">{{ row.label }}</span>
      </div>
    </div>
    <p class="chart__hint">{{ t('analytics.chart.hint') }}</p>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}
.chart__svg {
  display: block;
  max-width: 100%;
  height: auto;
  overflow: visible;
  font-family: var(--oxfe-font-family, Roboto, sans-serif);
}
.chart__svg:focus-visible {
  outline: 2px solid var(--oxfe-color-primary, #2471a3);
  outline-offset: 4px;
  border-radius: var(--oxfe-radius-sm, 4px);
}
.chart__gridline {
  stroke: var(--oxfe-color-border, #e0e0e0);
  stroke-width: 1;
}
.chart__tick {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  fill: var(--oxfe-color-text-muted, #666666);
}
.chart__wash {
  fill: var(--oxfe-color-primary, #2471a3);
  fill-opacity: 0.1;
}
.chart__line {
  fill: none;
  stroke: var(--oxfe-color-primary, #2471a3);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.chart__ring {
  fill: var(--oxfe-color-surface, #ffffff);
}
.chart__marker {
  fill: var(--oxfe-color-primary, #2471a3);
}
.chart__end-label {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  fill: var(--oxfe-color-text, #333333);
}
.chart__crosshair {
  stroke: var(--oxfe-color-text-muted, #666666);
  stroke-width: 1;
}
.chart__tooltip {
  position: absolute;
  top: 0.5rem;
  display: grid;
  gap: 0.2rem;
  min-width: 11rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--oxfe-color-text, #333333);
  background: var(--oxfe-color-surface, #ffffff);
  border: 1px solid var(--oxfe-color-border, #e0e0e0);
  border-radius: var(--oxfe-radius-md, 6px);
  box-shadow: 0 6px 16px rgb(0 0 0 / 12%);
  pointer-events: none;
}
.chart__tooltip-bucket {
  margin-bottom: 0.2rem;
  color: var(--oxfe-color-text-muted, #666666);
}
.chart__row {
  display: grid;
  grid-template-columns: 1rem auto 1fr;
  gap: 0.4rem;
  align-items: center;
}
.chart__row strong {
  font-variant-numeric: tabular-nums;
}
.chart__row-label {
  color: var(--oxfe-color-text-muted, #666666);
}
.chart__key {
  display: inline-block;
  width: 1rem;
  height: 2px;
  background: transparent;
}
.chart__key--plotted {
  background: var(--oxfe-color-primary, #2471a3);
}
.chart__hint {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--oxfe-color-text-muted, #666666);
}
</style>

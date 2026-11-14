<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { pieArcs } from '../series/pie';
import { formatShare } from '../series/format';

/** One piece of the pie as the page names it: the label and the value are already in the language of the page. */
export interface PieSlice {
  key: string;
  label: string;
  /** the value in the unit of the measure, formatted */
  valueText: string;
  /** percent, one decimal */
  share: number;
  kind: 'item' | 'others';
}

/**
 * A pie in SVG, drawn by hand like the curve (no chart library): slices in theme colours with a legend that names
 * every slice (label, value, share), because a colour alone carries no meaning. The pointer or the focus on a slice
 * or a legend entry reads one slice out.
 */
/** `colours` has one entry per slice (the page's palette): the slice and its legend swatch are painted with it. */
const props = defineProps<{ slices: PieSlice[]; colours: string[]; name: string }>();
const { locale } = useI18n();

const arcs = computed(() => pieArcs(props.slices.map((slice) => slice.share)));
const active = ref<string | null>(null);

const label = (slice: PieSlice): string =>
  `${slice.label} ${formatShare(slice.share, locale.value)}`;
const ariaLabel = computed(() => `${props.name}: ${props.slices.map(label).join(', ')}`);
const readout = computed(() => {
  const slice = props.slices.find((entry) => entry.key === active.value);
  return slice === undefined
    ? ''
    : `${slice.label}: ${slice.valueText} (${formatShare(slice.share, locale.value)})`;
});

const sliceFor = (index: number): PieSlice => props.slices[index]!;
</script>

<template>
  <div class="pie" data-test="pie">
    <svg
      v-if="arcs.length > 0"
      class="pie__svg"
      viewBox="-4 -4 208 208"
      role="img"
      :aria-label="ariaLabel"
      data-test="pie-svg"
    >
      <template v-for="arc in arcs" :key="sliceFor(arc.index).key">
        <circle
          v-if="arc.full"
          cx="100"
          cy="100"
          r="100"
          class="pie__slice"
          :class="{
            'pie__slice--active': active === sliceFor(arc.index).key,
          }"
          :style="{ fill: colours[arc.index] }"
          data-test="pie-slice"
          @pointerenter="active = sliceFor(arc.index).key"
          @pointerleave="active = null"
        />
        <path
          v-else
          :d="arc.path ?? ''"
          class="pie__slice"
          :class="{
            'pie__slice--active': active === sliceFor(arc.index).key,
          }"
          :style="{ fill: colours[arc.index] }"
          data-test="pie-slice"
          @pointerenter="active = sliceFor(arc.index).key"
          @pointerleave="active = null"
        />
      </template>
    </svg>
    <div class="pie__side">
      <p class="pie__readout" role="status" data-test="pie-readout">{{ readout }}</p>
      <ul class="pie__legend" data-test="pie-legend">
        <li
          v-for="(slice, at) in slices"
          :key="slice.key"
          class="pie__legend-item"
          :class="{
            'pie__legend-item--others': slice.kind === 'others',
            'pie__legend-item--active': active === slice.key,
          }"
          tabindex="0"
          data-test="pie-legend-item"
          @pointerenter="active = slice.key"
          @pointerleave="active = null"
          @focus="active = slice.key"
          @blur="active = null"
        >
          <span class="pie__swatch" :style="{ background: colours[at] }" aria-hidden="true" />
          <span class="pie__label">{{ slice.label }}</span>
          <span class="pie__value">{{ slice.valueText }}</span>
          <span class="pie__share">{{ formatShare(slice.share, locale) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.pie {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
}
.pie__svg {
  flex: 0 0 auto;
  width: min(100%, 15rem);
  height: auto;
}
.pie__slice {
  /* the fill is the slice's colour from the palette (inline); the stroke separates the slices */
  stroke: var(--oxfe-color-surface, #ffffff);
  stroke-width: 1.5;
}
.pie__slice--active {
  stroke: var(--oxfe-color-text, #333333);
  stroke-width: 2.5;
}
.pie__side {
  flex: 1 1 14rem;
  min-width: 0;
}
.pie__readout {
  min-height: 1.5rem;
  margin: 0 0 0.5rem;
  font-weight: 600;
  color: var(--oxfe-color-text, #333333);
}
.pie__legend {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pie__legend-item {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.2rem 0.35rem;
  font-size: 0.875rem;
  color: var(--oxfe-color-text, #333333);
  border-radius: var(--oxfe-radius-sm, 4px);
}
.pie__legend-item:focus-visible {
  outline: 2px solid var(--oxfe-color-primary, #2471a3);
  outline-offset: 1px;
}
.pie__legend-item--active {
  background: color-mix(in srgb, var(--oxfe-color-primary, #2471a3) 10%, transparent);
}
.pie__swatch {
  width: 0.75rem;
  height: 0.75rem;
  align-self: center;
  border: 1px solid var(--oxfe-color-border, #e0e0e0);
  border-radius: 2px;
}
.pie__label {
  overflow-wrap: anywhere;
}
.pie__value,
.pie__share {
  font-variant-numeric: tabular-nums;
  color: var(--oxfe-color-text-muted, #666666);
}
.pie__share {
  min-width: 3.5rem;
  font-weight: 600;
  text-align: right;
  color: var(--oxfe-color-text, #333333);
}
</style>

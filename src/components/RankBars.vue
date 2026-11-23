<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { formatShare } from '../series/format';

/** One bar as the page names it: label and value are already in the language of the page. */
export interface BarRow {
  key: string;
  label: string;
  valueText: string;
  /** percent, one decimal */
  share: number;
  kind: 'item' | 'others';
  /** the page the row opens; null or missing: plain text ("Others", demo data) */
  href?: string | null;
}

/**
 * Horizontal bars, best first: the label, the bar in proportion to the share (the longest fills the track) and the
 * value with its share as text. Plain markup and one CSS custom property per bar, so a long title wraps instead of
 * running off a narrow screen.
 */
const props = defineProps<{ rows: BarRow[]; name: string }>();
const { locale } = useI18n();

const widest = computed(() => Math.max(...props.rows.map((row) => row.share), 0));
const rowProps = (row: BarRow): { to: string } | Record<string, never> =>
  row.href ? { to: row.href } : {};
const widthOf = (row: BarRow): string =>
  `${widest.value > 0 ? Math.round((row.share / widest.value) * 1000) / 10 : 0}%`;
</script>

<template>
  <ul class="bars" :aria-label="name" data-test="rank-bars">
    <li
      v-for="row in rows"
      :key="row.key"
      :class="{ 'bars__row--others': row.kind === 'others' }"
      data-test="rank-bar"
    >
      <component
        :is="row.href ? RouterLink : 'div'"
        v-bind="rowProps(row)"
        class="bars__row"
        :class="{ 'bars__row--link': row.href }"
      >
        <span class="bars__label">{{ row.label }}</span>
        <span class="bars__track" aria-hidden="true">
          <span
            class="bars__fill"
            :style="{ '--bar-width': widthOf(row) }"
            data-test="rank-bar-fill"
          />
        </span>
        <span class="bars__value">{{ row.valueText }} · {{ formatShare(row.share, locale) }}</span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bars__row {
  display: grid;
  grid-template-columns: minmax(7rem, 14rem) minmax(0, 1fr) auto;
  gap: 0.2rem 0.75rem;
  align-items: center;
  font-size: 0.875rem;
  color: var(--oxfe-color-text, #333333);
}
.bars__row--link {
  text-decoration: none;
  border-radius: var(--oxfe-radius-sm, 4px);
}
.bars__row--link .bars__label {
  /* the text colour, not the link blue: the label also sits on the tinted hover and focus background */
  text-decoration: underline;
}
.bars__row--link:hover,
.bars__row--link:focus-visible {
  background: color-mix(in srgb, var(--oxfe-color-primary, #2471a3) 10%, transparent);
}
.bars__row--link:focus-visible {
  outline: 2px solid var(--oxfe-color-primary, #2471a3);
  outline-offset: 2px;
}
.bars__label {
  overflow-wrap: anywhere;
}
.bars__track {
  display: block;
  height: 0.9rem;
  background: color-mix(in srgb, var(--oxfe-color-border, #e0e0e0) 55%, transparent);
  border-radius: var(--oxfe-radius-sm, 4px);
  overflow: hidden;
}
.bars__fill {
  display: block;
  width: var(--bar-width, 0%);
  height: 100%;
  background: var(--oxfe-color-primary, #2471a3);
  border-radius: var(--oxfe-radius-sm, 4px);
}
.bars__row--others .bars__fill {
  background: var(--oxfe-color-text-muted, #666666);
  opacity: 0.55;
}
.bars__value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: right;
}
/* a narrow screen (360 px): the label takes its own line, bar and value share the next */
@media (max-width: 40rem) {
  .bars__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .bars__label {
    grid-column: 1 / -1;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { rankingFileName } from '../export/download';
import { exportTable, type ExportFormat } from '../export/exportTable';
import { rankingTable } from '../export/table';
import { dayKey } from '../series/buckets';
import { formatShare, formatValue } from '../series/format';
import {
  NONE_KEY,
  rankingSlices,
  RANK_MEASURES,
  TOP_N_CHOICES,
  type PopularSubject,
  type RankSlice,
} from '../series/ranking';
import { POPULAR_CHARTS, type Popular } from '../usePopular';
import ExportMenu from './ExportMenu.vue';
import PieChart, { type PieSlice } from './PieChart.vue';
import RankBars, { type BarRow } from './RankBars.vue';

/**
 * Popular products or categories: the headline (what the top N hold of the whole), the choice of N, the measure and
 * the chart, the chart itself (pie or bars, with "others" so that the whole is shown) and the same numbers as a sorted
 * list. Every control has a `data-field` id: the admin assistant points at them (`uiFields` of the plugin).
 */
const props = defineProps<{ subject: PopularSubject; popular: Popular }>();
const { t, locale } = useI18n();

const ranking = computed(() => props.popular.ranking.value);
const state = props.popular.state;

const unitOf = (): 'currency' | 'count' =>
  ranking.value.measure === 'sales' ? 'currency' : 'count';
const valueText = (value: number): string =>
  formatValue(value, unitOf(), locale.value, false, ranking.value.currency);

const labelOf = (slice: RankSlice): string => {
  if (slice.kind === 'others') {
    return t('analytics.popular.others');
  }
  return slice.key === NONE_KEY ? t('analytics.popular.noCategory') : slice.title;
};

const pieSlices = computed<PieSlice[]>(() =>
  rankingSlices(ranking.value).map((slice) => ({
    key: slice.key,
    label: labelOf(slice),
    valueText: valueText(slice.value),
    share: slice.share,
    kind: slice.kind,
  })),
);
const barRows = computed<BarRow[]>(() => pieSlices.value);

const headline = computed(() =>
  t(`analytics.popular.${props.subject}.headline`, {
    n: state.topN,
    share: formatShare(ranking.value.topShare, locale.value),
    of: t(`analytics.popular.of.${ranking.value.measure}`),
  }),
);

const linkable = computed(() => props.popular.source.value === 'live');
const hrefOf = (id: string | null): string | null => {
  if (!linkable.value || id === null) {
    return null;
  }
  return props.subject === 'products' ? `/catalogue/products/${id}` : `/catalogue/categories/${id}`;
};
const titleOf = (id: string | null, title: string): string =>
  id === null ? t('analytics.popular.noCategory') : title;
const field = (name: string): string => `analytics.${props.subject}.${name}`;

const exportItems = computed(() => [
  { format: 'xlsx', label: t('analytics.export.xlsxRanked') },
  { format: 'csv', label: t('analytics.export.csvRanked') },
]);
const exportField = computed(() => `analytics.export.top_${props.subject}`);

/** The ranked list as the file holds it: the list below, with "Others", in the order of the page. */
const table = computed(() =>
  rankingTable({
    title: headline.value,
    demo: props.popular.source.value === 'demo',
    meta: [],
    ranking: ranking.value,
    withNumber: props.subject === 'products',
    rank: t('analytics.popular.list.rank'),
    name: t(`analytics.popular.${props.subject}.column`),
    number: t('analytics.popular.list.number'),
    value: t(`analytics.popular.measure.${ranking.value.measure}`),
    share: t('analytics.popular.list.share'),
    others: t('analytics.popular.others'),
    noCategory: t('analytics.popular.noCategory'),
  }),
);

/** Downloads the list that the section shows; the export menu and the admin assistant both call it. */
function exportAs(format: ExportFormat): void {
  const { from, to } = props.popular.range.value;
  exportTable(
    table.value,
    format,
    (extension) =>
      rankingFileName(props.subject, ranking.value.measure, dayKey(from), dayKey(to), extension),
    locale.value,
    t('analytics.export.demoNote'),
  );
}
defineExpose({ exportAs });
</script>

<template>
  <section class="popular" :data-test="`popular-${subject}`" :data-source="popular.source.value">
    <div class="popular__head">
      <h2>{{ t(`analytics.popular.${subject}.title`) }}</h2>
      <ExportMenu
        :label="t(`analytics.export.${subject}`)"
        :items="exportItems"
        :field-id="exportField"
        @select="exportAs($event as ExportFormat)"
      />
    </div>
    <form class="popular__controls fold-grid" @submit.prevent>
      <label>
        {{ t('analytics.popular.controls.topN') }}
        <select v-model.number="state.topN" :data-field="field('topN')" data-test="popular-topn">
          <option v-for="n in TOP_N_CHOICES" :key="n" :value="n">
            {{ t('analytics.popular.controls.topOption', { n }) }}
          </option>
        </select>
      </label>
      <label>
        {{ t('analytics.popular.controls.measure') }}
        <select v-model="state.measure" :data-field="field('measure')" data-test="popular-measure">
          <option v-for="measure in RANK_MEASURES" :key="measure" :value="measure">
            {{ t(`analytics.popular.measure.${measure}`) }}
          </option>
        </select>
      </label>
      <label>
        {{ t('analytics.popular.controls.chart') }}
        <select v-model="state.chart" :data-field="field('chart')" data-test="popular-chart">
          <option v-for="chart in POPULAR_CHARTS" :key="chart" :value="chart">
            {{ t(`analytics.popular.controls.${chart}`) }}
          </option>
        </select>
      </label>
    </form>
    <p class="popular__note" data-test="popular-note">
      {{ t(`analytics.popular.${subject}.note`) }}
    </p>
    <p v-if="ranking.items.length === 0" class="popular__empty" data-test="popular-empty">
      {{ t('analytics.popular.empty') }}
    </p>
    <template v-else>
      <p class="popular__headline" data-test="popular-headline">{{ headline }}</p>
      <PieChart v-if="state.chart === 'pie'" :slices="pieSlices" :name="headline" />
      <RankBars v-else :rows="barRows" :name="headline" />
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        :aria-label="t(`analytics.popular.${subject}.title`)"
      >
        <table class="popular__list" data-test="popular-list">
          <caption class="popular__caption">
            {{
              t(`analytics.popular.${subject}.title`)
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t('analytics.popular.list.rank') }}</th>
              <th scope="col">{{ t(`analytics.popular.${subject}.column`) }}</th>
              <th scope="col" class="popular__number">{{ t('analytics.popular.list.value') }}</th>
              <th scope="col" class="popular__number">{{ t('analytics.popular.list.share') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in ranking.items" :key="item.id ?? 'none'" data-test="popular-row">
              <th scope="row">{{ item.rank }}</th>
              <td>
                <RouterLink
                  v-if="hrefOf(item.id)"
                  :to="hrefOf(item.id) ?? ''"
                  class="popular__link"
                  data-test="popular-link"
                >
                  {{ titleOf(item.id, item.title) }}
                </RouterLink>
                <template v-else>{{ titleOf(item.id, item.title) }}</template>
                <span v-if="item.number" class="popular__code"> · {{ item.number }}</span>
              </td>
              <td class="popular__number">{{ valueText(item.value) }}</td>
              <td class="popular__number" data-test="popular-share">
                {{ formatShare(item.share, locale) }}
              </td>
            </tr>
            <tr v-if="ranking.others > 0" class="popular__others" data-test="popular-others">
              <th scope="row">–</th>
              <td>{{ t('analytics.popular.others') }}</td>
              <td class="popular__number">{{ valueText(ranking.others) }}</td>
              <td class="popular__number" data-test="popular-share">
                {{ formatShare(ranking.othersShare, locale) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.popular {
  min-width: 0; /* a grid item may shrink below its widest table: the table scrolls inside its box */
  padding: 1.5rem;
  background: var(--oxfe-color-surface, #ffffff);
  border-radius: var(--oxfe-radius-lg, 8px);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 6%),
    0 1px 3px rgb(0 0 0 / 8%);
}
.popular > * + * {
  margin-top: 1rem;
}
.popular__head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}
.popular__head > h2 {
  margin: 0;
}
.popular__controls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.75rem 1rem;
}
.popular__note {
  margin: 0;
  font-size: 0.875rem;
  color: var(--oxfe-color-text-muted, #666666);
}
.popular__headline {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--oxfe-color-text, #333333);
}
.popular__empty {
  margin: 0;
  color: var(--oxfe-color-text-muted, #666666);
}
.popular__caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.popular__link {
  color: var(--oxfe-color-link, #2471a3);
}
.popular__code {
  color: var(--oxfe-color-text-muted, #666666);
  font-size: 0.8125rem;
}
.popular__number {
  white-space: nowrap;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.popular__others td,
.popular__others th {
  color: var(--oxfe-color-text-muted, #666666);
}
</style>

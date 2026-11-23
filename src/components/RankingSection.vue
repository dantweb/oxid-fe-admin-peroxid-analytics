<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { barsToPng, svgToPng, type ChartPng } from '../export/chartImage';
import { rankingFileName } from '../export/download';
import { exportPdf } from '../export/exportPdf';
import type { PdfLegendEntry } from '../export/pdf';
import { parseColour, type Rgb } from '../series/palette';
import { usePalette } from '../usePalette';
import { exportTable, type ExportFormat } from '../export/exportTable';
import { rankingTable } from '../export/table';
import { dayKey } from '../series/buckets';
import { formatShare, formatValue } from '../series/format';
import {
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

/** An item without an id is "No category" in a category ranking; a product without one was deleted: its own title. */
const labelOf = (slice: RankSlice, at: number): string => {
  if (slice.kind === 'others') {
    return t('analytics.popular.others');
  }
  const noCategory = props.subject === 'categories' && ranking.value.items[at]?.id === null;
  return noCategory ? t('analytics.popular.noCategory') : slice.title;
};

/** One address per item for the list, the pie, its legend and the bars; "Others" and demo items have none. */
const linkable = computed(() => props.popular.source.value === 'live');
const hrefOf = (id: string | null): string | null => {
  if (!linkable.value || id === null) {
    return null;
  }
  return props.subject === 'products' ? `/catalogue/products/${id}` : `/catalogue/categories/${id}`;
};

const pieSlices = computed<PieSlice[]>(() =>
  rankingSlices(ranking.value).map((slice, at) => ({
    key: slice.key,
    label: labelOf(slice, at),
    valueText: valueText(slice.value),
    share: slice.share,
    kind: slice.kind,
    href: slice.kind === 'others' ? null : hrefOf(ranking.value.items[at]?.id ?? null),
  })),
);
const barRows = computed<BarRow[]>(() => pieSlices.value);

/** One distinct colour per item and a grey for "Others", from the theme tokens (src/series/palette.ts). */
const palette = usePalette(() => ranking.value.items.length);
const sliceColours = computed(() =>
  pieSlices.value.map((slice, at) =>
    slice.kind === 'others' ? palette.value.others : palette.value.slices[at]!,
  ),
);

const headline = computed(() =>
  t(`analytics.popular.${props.subject}.headline`, {
    n: state.topN,
    share: formatShare(ranking.value.topShare, locale.value),
    of: t(`analytics.popular.of.${ranking.value.measure}`),
  }),
);

const titleOf = (id: string | null, title: string): string =>
  id === null && props.subject === 'categories' ? t('analytics.popular.noCategory') : title;
const field = (name: string): string => `analytics.${props.subject}.${name}`;

const root = ref<HTMLElement | null>(null);

const exportItems = computed(() => [
  { format: 'pdf', label: t('analytics.export.pdfRanked') },
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

const barColours = (): { fill: string; muted: string; text: string; track: string } => {
  const colour = (
    selector: string,
    property: 'backgroundColor' | 'color',
    fallback: string,
  ): string => {
    const element = root.value?.querySelector(selector);
    return element === null || element === undefined
      ? fallback
      : getComputedStyle(element)[property];
  };
  const fill = colour('.bars__fill', 'backgroundColor', '#2471a3');
  return {
    fill,
    muted: colour('.bars__row--others .bars__fill', 'backgroundColor', fill),
    text: root.value === null ? '#333333' : getComputedStyle(root.value).color,
    track: colour('.bars__track', 'backgroundColor', '#e0e0e0'),
  };
};

/** The colour of each legend line: the slice's colour in the pie, the colour of the bar in the bars. */
function legendColours(): Rgb[] {
  if (props.popular.state.chart === 'pie') {
    return pieSlices.value.map((slice, at) =>
      slice.kind === 'others' ? palette.value.othersRgb : palette.value.slicesRgb[at]!,
    );
  }
  const { fill, muted } = barColours();
  const [item, others] = [
    parseColour(fill) ?? palette.value.slicesRgb[0]!,
    parseColour(muted) ?? palette.value.othersRgb,
  ];
  return pieSlices.value.map((slice) => (slice.kind === 'others' ? others : item));
}

/** The legend of the PDF: a line per slice, with the colour it has on screen. */
function pdfLegend(): PdfLegendEntry[] {
  const colours = legendColours();
  return pieSlices.value.map((slice, at) => ({
    colour: colours[at]!,
    rank: slice.kind === 'others' ? '' : String(at + 1),
    title: slice.label,
    valueText: slice.valueText,
    shareText: formatShare(slice.share, locale.value),
  }));
}

/** The chart as the section shows it, as an image: the pie's SVG, or the bars drawn from the colours on screen. */
async function chartImage(): Promise<ChartPng | null> {
  if (props.popular.state.chart === 'pie') {
    const svg = root.value?.querySelector<SVGSVGElement>('[data-test="pie-svg"]') ?? null;
    return svg === null ? null : svgToPng(svg);
  }
  return barsToPng(barRows.value, barColours());
}

/** Downloads the list that the section shows; the export menu and the admin assistant both call it. */
async function exportAs(format: ExportFormat): Promise<void> {
  const { from, to } = props.popular.range.value;
  const fileName = (extension: ExportFormat): string =>
    rankingFileName(props.subject, ranking.value.measure, dayKey(from), dayKey(to), extension);
  if (format === 'pdf') {
    const period = t('analytics.export.period', { from: dayKey(from), to: dayKey(to) });
    const measure = t('analytics.export.measure', {
      value: t(`analytics.popular.measure.${ranking.value.measure}`),
    });
    const source = t('analytics.export.source', {
      value: t(
        props.popular.source.value === 'live'
          ? 'analytics.export.sourceLive'
          : 'analytics.export.sourceDemo',
      ),
    });
    await exportPdf(
      { ...table.value, meta: [period, measure, source] },
      await chartImage(),
      fileName('pdf'),
      {
        locale: locale.value,
        demoNote: t('analytics.export.demoNote'),
        created: (date) => t('analytics.export.created', { date }),
        pageOf: (page, pages) => t('analytics.export.page', { page, pages }),
      },
      pdfLegend(),
    );
    return;
  }
  exportTable(table.value, format, fileName, locale.value, t('analytics.export.demoNote'));
}
defineExpose({ exportAs });
</script>

<template>
  <section
    ref="root"
    class="popular"
    :data-test="`popular-${subject}`"
    :data-source="popular.source.value"
  >
    <div class="popular__head">
      <h2>{{ t(`analytics.popular.${subject}.title`) }}</h2>
      <ExportMenu
        :label="t(`analytics.export.${subject}`)"
        :items="exportItems"
        :field-id="exportField"
        @select="void exportAs($event as ExportFormat)"
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
      <PieChart
        v-if="state.chart === 'pie'"
        :slices="pieSlices"
        :colours="sliceColours"
        :name="headline"
      />
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
  /* the controls follow the width of the section, not of the page */
  container: popular / inline-size;
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
  grid-template-columns: minmax(0, 1fr);
  gap: var(--analytics-gap, 1rem);
}
.popular__controls > label {
  min-width: 0;
}
.popular__controls select {
  width: 100%;
  min-width: 0;
}
@container popular (min-width: 28rem) {
  .popular__controls {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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

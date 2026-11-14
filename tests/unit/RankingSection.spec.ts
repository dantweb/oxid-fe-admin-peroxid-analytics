import { describe, expect, it } from 'vitest';
import { computed } from 'vue';
import RankingSection from '../../src/components/RankingSection.vue';
import { generateDemoData } from '../../src/ecw/demoData';
import type { Executor, LiveRankingAnswer } from '../../src/liveSource';
import { lastDays } from '../../src/series/buckets';
import type { PopularSubject } from '../../src/series/ranking';
import { usePopular, type PopularContext } from '../../src/usePopular';
import { mountInAdmin } from './helpers';

const TODAY = new Date(2026, 10, 4, 12);
const data = generateDemoData({ today: TODAY, days: 60, seed: 1 });
const range = computed(() => lastDays(TODAY, 30));
const context = (client: Executor | null = null): PopularContext => ({
  range,
  data: () => data,
  client,
});

const answer = (): LiveRankingAnswer => ({
  measure: 'SALES',
  currency: 'CHF',
  total: 100,
  topTotal: 90,
  topShare: 90,
  others: 10,
  othersShare: 10,
  items: [
    { rank: 1, entityId: 'p1', number: 'A-1', title: 'Alpha', value: 60, share: 60 },
    { rank: 2, entityId: null, number: null, title: 'No category', value: 30, share: 30 },
  ],
});

const shop = (): Executor => ({
  execute: async <T>(): Promise<T> =>
    ({
      adminAnalyticsTopProducts: answer(),
      adminAnalyticsTopCategories: answer(),
    }) as unknown as T,
});

async function mountSection(
  subject: PopularSubject = 'products',
  client: Executor | null = null,
  locale = 'en',
) {
  const popular = usePopular(subject, context(client));
  await popular.ready;
  const wrapper = mountInAdmin(RankingSection, { props: { subject, popular } });
  wrapper.vm.$i18n.locale = locale;
  await wrapper.vm.$nextTick();
  return { wrapper, popular };
}

describe('RankingSection', () => {
  it('lists the top 5 best first with rank, title, value and share, then others, and says how much the top holds', async () => {
    const { wrapper, popular } = await mountSection();

    const rows = wrapper.findAll('[data-test="popular-row"]');
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.get('th').text())).toEqual(['1', '2', '3', '4', '5']);
    const values = popular.ranking.value.items.map((item) => item.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(rows[0]!.text()).toContain(popular.ranking.value.items[0]!.title);
    expect(wrapper.get('[data-test="popular-others"]').text()).toContain('Others');
    expect(wrapper.get('[data-test="popular-headline"]').text()).toMatch(
      /^Top 5 products: \d+\.\d %\s+of sales$/,
    );
    expect(wrapper.get('[data-test="popular-headline"]').text()).toContain(
      `${popular.ranking.value.topShare.toFixed(1)} %`,
    );
  });

  it('shows the list shares and the others share so that the list adds up to 100 %', async () => {
    const { wrapper } = await mountSection();

    const shares = wrapper
      .findAll('[data-test="popular-share"]')
      .map((cell) => Number.parseFloat(cell.text()));

    expect(shares).toHaveLength(6);
    expect(Math.round(shares.reduce((sum, share) => sum + share, 0) * 10)).toBe(1000);
  });

  it('links a product to its page and a category to its page, and leaves the no-category line and demo data unlinked', async () => {
    const products = await mountSection('products', shop());
    const categories = await mountSection('categories', shop());
    const demo = await mountSection('products');

    const productLinks = products.wrapper.findAll('[data-test="popular-link"]');
    expect(productLinks.map((link) => link.attributes('href'))).toEqual(['/catalogue/products/p1']);
    expect(
      categories.wrapper
        .findAll('[data-test="popular-link"]')
        .map((link) => link.attributes('href')),
    ).toEqual(['/catalogue/categories/p1']);
    expect(products.wrapper.findAll('[data-test="popular-row"]')[1]!.text()).toContain(
      'No category',
    );
    expect(demo.wrapper.findAll('[data-test="popular-link"]')).toHaveLength(0);
  });

  it('the Top N selector drives the list, the chart and the headline together', async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll('[data-test="pie-slice"]')).toHaveLength(6); // 5 + others

    await wrapper.get('[data-test="popular-topn"]').setValue('10');

    expect(wrapper.findAll('[data-test="popular-row"]')).toHaveLength(10);
    expect(wrapper.findAll('[data-test="pie-slice"]')).toHaveLength(11);
    expect(wrapper.get('[data-test="popular-headline"]').text()).toContain('Top 10 products');
    expect(
      wrapper
        .get('[data-test="popular-topn"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['Top 3', 'Top 5', 'Top 10', 'Top 15', 'Top 20']);
  });

  it('the measure selector re-ranks by units and by orders and the headline names the measure', async () => {
    const { wrapper } = await mountSection();

    await wrapper.get('[data-test="popular-measure"]').setValue('units');
    expect(wrapper.get('[data-test="popular-headline"]').text()).toMatch(/of units sold$/);
    expect(wrapper.get('[data-test="popular-row"]').text()).not.toMatch(/€/);

    await wrapper.get('[data-test="popular-measure"]').setValue('orders');
    expect(wrapper.get('[data-test="popular-headline"]').text()).toMatch(/of orders$/);

    await wrapper.get('[data-test="popular-measure"]').setValue('sales');
    expect(wrapper.get('[data-test="popular-row"]').text()).toMatch(/€/);
  });

  it('the chart switch changes between the pie and the bars, both with a label for every item', async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find('[data-test="pie"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="rank-bars"]').exists()).toBe(false);

    await wrapper.get('[data-test="popular-chart"]').setValue('bars');

    expect(wrapper.find('[data-test="pie"]').exists()).toBe(false);
    const bars = wrapper.findAll('[data-test="rank-bar"]');
    expect(bars).toHaveLength(6); // 5 + others
    expect(bars[0]!.text()).toContain('€');
    const widths = bars.map((bar) =>
      Number.parseFloat(
        /--bar-width: ([\d.]+)%/.exec(
          bar.get('[data-test="rank-bar-fill"]').attributes('style') ?? '',
        )?.[1] ?? '',
      ),
    );
    expect(Math.max(...widths)).toBe(100); // the longest bar fills the track, the others are in proportion
    expect(widths.slice(0, 5)).toEqual([...widths.slice(0, 5)].sort((a, b) => b - a));
    expect(bars[5]!.text()).toContain('Others');
    expect(
      wrapper
        .get('[data-test="popular-chart"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['Pie', 'Bars']);
  });

  it('gives the headline, the selectors and the others line in German too', async () => {
    const { wrapper } = await mountSection('categories', null, 'de');

    expect(wrapper.get('h2').text()).toBe('Beliebte Kategorien');
    expect(wrapper.get('[data-test="popular-headline"]').text()).toMatch(
      /^Top 5 Kategorien: \d+,\d %\s+des Umsatzes$/,
    );
    expect(wrapper.get('[data-test="popular-others"]').text()).toContain('Übrige');
    expect(
      wrapper
        .get('[data-test="popular-measure"]')
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['Umsatz', 'Verkaufte Stück', 'Anzahl Bestellungen']);
  });

  it('gives every control a data-field id the assistant can point at', async () => {
    const { wrapper } = await mountSection('products');

    expect(
      ['topn', 'measure', 'chart'].map((name) =>
        wrapper.get(`[data-test="popular-${name}"]`).attributes('data-field'),
      ),
    ).toEqual([
      'analytics.products.topN',
      'analytics.products.measure',
      'analytics.products.chart',
    ]);
    const categories = await mountSection('categories');
    expect(categories.wrapper.get('[data-test="popular-topn"]').attributes('data-field')).toBe(
      'analytics.categories.topN',
    );
  });

  it('says so instead of drawing an empty chart when the period has no sales', async () => {
    const empty = computed(() => lastDays(new Date(2020, 0, 10), 7));
    const popular = usePopular('products', { range: empty, data: () => data, client: null });
    const wrapper = mountInAdmin(RankingSection, { props: { subject: 'products', popular } });

    expect(wrapper.get('[data-test="popular-empty"]').text()).toBe('No sales in this period.');
    expect(wrapper.find('[data-test="pie"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="popular-headline"]').exists()).toBe(false);
  });

  it('tells which source the section shows', async () => {
    const live = await mountSection('products', shop());
    const demo = await mountSection('products');

    expect(live.wrapper.get('[data-test="popular-products"]').attributes('data-source')).toBe(
      'live',
    );
    expect(demo.wrapper.get('[data-test="popular-products"]').attributes('data-source')).toBe(
      'demo',
    );
  });

  it('every slice of the pie has its own colour, "Others" included, and the legend swatches are the same colours', async () => {
    const { wrapper } = await mountSection();
    await wrapper.get('[data-test="popular-topn"]').setValue('15');

    const fills = wrapper
      .findAll('[data-test="pie-slice"]')
      .map((slice) => /fill: ([^;]+)/.exec(slice.attributes('style') ?? '')?.[1]);
    const swatches = wrapper
      .findAll('.pie__swatch')
      .map((swatch) => /background: ([^;]+)/.exec(swatch.attributes('style') ?? '')?.[1]);

    expect(fills).toHaveLength(16);
    expect(new Set(fills).size).toBe(16);
    expect(swatches).toEqual(fills);
  });

  it('a deleted product (no id) keeps its title, is not linked and does not collide with another one', async () => {
    const gone = (rank: number, title: string) => ({
      rank,
      entityId: null,
      number: `G-${rank}`,
      title,
      value: 10,
      share: 25,
    });
    const client: Executor = {
      execute: async <T>(): Promise<T> =>
        ({
          adminAnalyticsTopProducts: {
            ...answer(),
            items: [gone(1, 'Gone Hat'), gone(2, 'Gone Cap')],
          },
        }) as unknown as T,
    };
    const { wrapper } = await mountSection('products', client);

    const rows = wrapper.findAll('[data-test="popular-row"]');
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('Gone Hat'),
      expect.stringContaining('Gone Cap'),
    ]);
    expect(wrapper.findAll('[data-test="popular-link"]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('No category');
    expect(wrapper.findAll('[data-test="pie-slice"]')).toHaveLength(3); // two items and Others
  });
});

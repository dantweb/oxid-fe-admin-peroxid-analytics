import type { DOMWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PieChart, { type PieSlice } from '../../src/components/PieChart.vue';
import { mountInAdmin } from './helpers';

const slice = (
  key: string,
  label: string,
  share: number,
  kind: PieSlice['kind'] = 'item',
): PieSlice => ({
  key,
  label,
  valueText: `${share * 10} units`,
  share,
  kind,
});

const cells = (item: DOMWrapper<Element>): string[] =>
  item.findAll('span:not(.pie__swatch)').map((cell) => cell.text());

const mountPie = (
  slices: PieSlice[],
  colours: string[] = slices.map((_, at) => `rgb(${at}, 100, 100)`),
) => mountInAdmin(PieChart, { props: { slices, colours, name: 'Share of sales' } });

describe('PieChart', () => {
  it('draws one slice per item with a share and names the chart for assistive technology', () => {
    const wrapper = mountPie([
      slice('a', 'Alpha', 50),
      slice('b', 'Beta', 30),
      slice('others', 'Others', 20, 'others'),
    ]);

    expect(wrapper.findAll('[data-test="pie-slice"]')).toHaveLength(3);
    const svg = wrapper.get('[data-test="pie-svg"]');
    expect(svg.attributes('role')).toBe('img');
    expect(svg.attributes('aria-label')).toBe(
      'Share of sales: Alpha 50.0 %, Beta 30.0 %, Others 20.0 %',
    );
  });

  it('lists every slice in a legend with its label, value and share, so a colour is never the only carrier', () => {
    const wrapper = mountPie([slice('a', 'Alpha', 70), slice('others', 'Others', 30, 'others')]);

    const items = wrapper.findAll('[data-test="pie-legend-item"]');
    expect(items.map(cells)).toEqual([
      ['Alpha', '700 units', '70.0 %'],
      ['Others', '300 units', '30.0 %'],
    ]);
    expect(items[1]!.classes()).toContain('pie__legend-item--others');
  });

  it('draws a single slice of 100 percent as a full circle', () => {
    const wrapper = mountPie([slice('a', 'Alpha', 100)]);

    const drawn = wrapper.findAll('[data-test="pie-slice"]');
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.element.tagName.toLowerCase()).toBe('circle');
  });

  it('leaves a 0 percent item out of the slices but keeps it in the legend', () => {
    const wrapper = mountPie([slice('a', 'Alpha', 100), slice('z', 'Zero', 0)]);

    expect(wrapper.findAll('[data-test="pie-slice"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="pie-legend-item"]').map(cells)).toEqual([
      ['Alpha', '1000 units', '100.0 %'],
      ['Zero', '0 units', '0.0 %'],
    ]);
  });

  it('shows label, value and share of the slice under the pointer, and marks its legend entry', async () => {
    const wrapper = mountPie([slice('a', 'Alpha', 60), slice('b', 'Beta', 40)]);

    await wrapper.findAll('[data-test="pie-slice"]')[1]!.trigger('pointerenter');

    expect(wrapper.get('[data-test="pie-readout"]').text()).toBe('Beta: 400 units (40.0 %)');
    expect(wrapper.findAll('[data-test="pie-legend-item"]')[1]!.classes()).toContain(
      'pie__legend-item--active',
    );
    await wrapper.findAll('[data-test="pie-slice"]')[1]!.trigger('pointerleave');
    expect(wrapper.get('[data-test="pie-readout"]').text()).toBe('');
  });

  it('the legend entries are as reachable as the slices: focus shows the same readout', async () => {
    const wrapper = mountPie([slice('a', 'Alpha', 60), slice('b', 'Beta', 40)]);

    await wrapper.findAll('[data-test="pie-legend-item"]')[0]!.trigger('focus');

    expect(wrapper.get('[data-test="pie-readout"]').text()).toBe('Alpha: 600 units (60.0 %)');
  });

  it('formats the share in the language of the page', async () => {
    const wrapper = mountPie([slice('a', 'Alpha', 33.4), slice('b', 'Beta', 66.6)]);
    wrapper.vm.$i18n.locale = 'de';
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="pie-legend-item"]').text()).toContain('33,4 %');
  });

  it('draws no svg and says nothing when there are no slices', () => {
    const wrapper = mountPie([]);

    expect(wrapper.find('[data-test="pie-svg"]').exists()).toBe(false);
  });

  it('paints every slice and its legend swatch with the colour it is given', () => {
    const wrapper = mountPie(
      [slice('a', 'Alpha', 50), slice('b', 'Beta', 30), slice('others', 'Others', 20, 'others')],
      ['rgb(10, 20, 30)', 'rgb(40, 50, 60)', 'rgb(70, 80, 90)'],
    );

    const fills = wrapper.findAll('[data-test="pie-slice"]').map((el) => el.attributes('style'));
    const swatches = wrapper.findAll('.pie__swatch').map((el) => el.attributes('style'));

    expect(fills[0]).toContain('fill: rgb(10, 20, 30)');
    expect(fills[2]).toContain('fill: rgb(70, 80, 90)');
    expect(swatches[1]).toContain('background: rgb(40, 50, 60)');
    expect(swatches[2]).toContain('background: rgb(70, 80, 90)');
  });

  it('a zero slice keeps its colour in the legend', () => {
    const wrapper = mountPie(
      [slice('a', 'Alpha', 100), slice('z', 'Zero', 0)],
      ['rgb(1, 1, 1)', 'rgb(2, 2, 2)'],
    );

    expect(wrapper.findAll('.pie__swatch')[1]!.attributes('style')).toContain('rgb(2, 2, 2)');
  });
});

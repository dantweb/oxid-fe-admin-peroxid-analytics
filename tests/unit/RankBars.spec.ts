import { describe, expect, it } from 'vitest';
import RankBars, { type BarRow } from '../../src/components/RankBars.vue';
import { mountInAdmin } from './helpers';

const row = (key: string, label: string, href: string | null = null): BarRow => ({
  key,
  label,
  valueText: '10 units',
  share: 50,
  kind: key === 'others' ? 'others' : 'item',
  href,
});

describe('RankBars links (Sprint 48)', () => {
  it('a row with an href is one link holding label, bar and value; a row without stays plain text', () => {
    const wrapper = mountInAdmin(RankBars, {
      props: {
        name: 'Top',
        rows: [row('p1', 'Alpha', '/catalogue/products/p1'), row('others', 'Others')],
      },
    });

    const rows = wrapper.findAll('[data-test="rank-bar"]');
    const link = rows[0]!.get('a');
    expect(link.attributes('href')).toBe('/catalogue/products/p1');
    expect(link.text()).toContain('Alpha');
    expect(link.text()).toContain('10 units');
    expect(link.find('[data-test="rank-bar-fill"]').exists()).toBe(true);
    expect(rows[1]!.find('a').exists()).toBe(false);
    expect(rows[1]!.text()).toContain('Others');
    expect(rows[1]!.find('[data-test="rank-bar-fill"]').exists()).toBe(true);
  });

  it('a click navigates through the router', async () => {
    const wrapper = mountInAdmin(RankBars, {
      props: { name: 'Top', rows: [row('p1', 'Alpha', '/catalogue/products/p1')] },
    });

    await wrapper.get('a').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/catalogue/products/p1');
  });
});

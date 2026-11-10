import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { mountInAdmin } from './helpers';

const SRC = join(__dirname, '../../src');
const files = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files(path, out);
    } else {
      out.push(path);
    }
  }
  return out;
};

/** The admin's fold contract: plugins style against data-segments and the tokens, never the segment queries. */
describe('foldables', () => {
  it('reads no viewport segment and no device posture itself', () => {
    const offenders = files(SRC).filter((path) =>
      /viewport-segment|device-posture/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the stat tiles and the filter row carry fold-grid, the chart card fold-pane-b', async () => {
    const wrapper = mountInAdmin(AnalyticsView);
    await nextTick();
    expect(wrapper.get('[data-test="analytics-stats"]').classes()).toContain('fold-grid');
    expect(wrapper.get('[data-test="analytics-filters"]').classes()).toContain('fold-grid');
    // the chart cannot be split: the card moves wholly into the content pane
    expect(wrapper.get('[data-test="analytics-chart-card"]').classes()).toContain('fold-pane-b');
  });
});

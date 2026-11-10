import { describe, expect, it } from 'vitest';
import { areaPath, bars, linearPath, linePath, smoothPath } from '../../src/series/curve';
import { formatBucket, formatPercent, formatValue, percentChange } from '../../src/series/format';
import { createYScale, LOG_FLOOR, niceStep, xCenters, xPositions } from '../../src/series/scale';

describe('linear scale', () => {
  it('nice steps: 1, 2, 5 × 10^n', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(7)).toBe(2);
    expect(niceStep(43)).toBe(10);
    expect(niceStep(4_300)).toBe(1000);
    expect(niceStep(12_000)).toBe(5000);
  });

  it('starts at 0, ends at the next nice value, ticks evenly; a bigger value is higher on screen', () => {
    const scale = createYScale({ values: [3, 43, 12], kind: 'linear', top: 10, bottom: 210 });

    expect(scale.domain).toEqual([0, 50]);
    expect(scale.ticks.map((t) => t.value)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(scale.y(0)).toBe(210);
    expect(scale.y(50)).toBe(10);
    expect(scale.y(43)).toBeLessThan(scale.y(12));
    expect(scale.y(-5)).toBe(210); // never below the baseline
  });

  it('all zeros still draws an axis', () => {
    const scale = createYScale({ values: [0, 0], kind: 'linear', top: 0, bottom: 100 });
    expect(scale.domain).toEqual([0, 1]);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });
});

describe('log scale', () => {
  it('floors at 1 (a zero bucket sits on the baseline) and ticks at powers of ten with 2 and 5 steps', () => {
    const scale = createYScale({ values: [0, 3, 850], kind: 'log', top: 0, bottom: 300 });

    expect(scale.kind).toBe('log');
    expect(scale.domain).toEqual([LOG_FLOOR, 1000]);
    expect(scale.y(0)).toBe(300);
    expect(scale.y(1)).toBe(300);
    expect(scale.y(1000)).toBe(0);
    expect(scale.y(10)).toBe(200);
    expect(scale.ticks.map((t) => t.value)).toEqual([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]);
  });

  it('many decades: powers of ten only', () => {
    const scale = createYScale({ values: [1, 5_000_000], kind: 'log', top: 0, bottom: 100 });
    expect(scale.ticks.map((t) => t.value)).toEqual([
      1, 10, 100, 1000, 10_000, 100_000, 1_000_000, 10_000_000,
    ]);
  });
});

describe('x positions and curves', () => {
  it('spreads points from left to right, one point in the middle', () => {
    expect(xPositions(3, 0, 100)).toEqual([0, 50, 100]);
    expect(xPositions(1, 0, 100)).toEqual([50]);
    expect(xPositions(0, 0, 100)).toEqual([]);
  });

  it('a smooth path passes through every point with a cubic segment between each pair', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 50, y: 40 },
      { x: 100, y: 20 },
    ];
    const path = smoothPath(points);

    expect(path.startsWith('M0 10')).toBe(true);
    expect(path.match(/ C/g)).toHaveLength(2);
    expect(path.endsWith('100 20')).toBe(true);
    expect(smoothPath([points[0]!])).toBe('M0 10');
    expect(smoothPath([])).toBe('');
    expect(areaPath(points, 100)).toMatch(/ L100 100 L0 100 Z$/);
    expect(areaPath([points[0]!], 100)).toBe('');
  });

  it('a straight path joins the points with line segments; the wash follows the chosen line; bars have neither', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 50, y: 40 },
      { x: 100, y: 20 },
    ];

    expect(linearPath(points)).toBe('M0 10 L50 40 L100 20');
    expect(linearPath([])).toBe('');
    expect(linePath(points, 'linear')).toBe('M0 10 L50 40 L100 20');
    expect(linePath(points, 'curved')).toBe(smoothPath(points));
    expect(linePath(points, 'bars')).toBe('');
    expect(areaPath(points, 100, 'linear')).toBe('M0 10 L50 40 L100 20 L100 100 L0 100 Z');
    expect(areaPath(points, 100, 'bars')).toBe('');
  });

  it('bars stand centred in their band, 60 % wide, from the value down to the baseline', () => {
    const points = [
      { x: 25, y: 10 },
      { x: 75, y: 100 },
    ];

    expect(bars(points, 100, 50)).toEqual([
      { x: 10, y: 10, width: 30, height: 90 },
      { x: 60, y: 100, width: 30, height: 0 },
    ]);
    expect(bars([{ x: 50, y: 120 }], 100, 100)).toEqual([{ x: 20, y: 100, width: 60, height: 0 }]);
    expect(bars([], 100, 50)).toEqual([]);
  });

  it('band centres keep the first and the last bar inside the plot', () => {
    expect(xCenters(4, 0, 100)).toEqual([12.5, 37.5, 62.5, 87.5]);
    expect(xCenters(1, 0, 100)).toEqual([50]);
    expect(xCenters(0, 0, 100)).toEqual([]);
  });
});

describe('formatting', () => {
  it('counts, euros and ratios; compact only on the axis above ten thousand', () => {
    expect(formatValue(1234, 'count', 'en')).toBe('1,234');
    expect(formatValue(12_345, 'count', 'en', true)).toBe('12K');
    expect(formatValue(12.5, 'currency', 'en')).toBe('€12.50');
    expect(formatValue(12_345, 'currency', 'en', true)).toBe('€12K');
    expect(formatValue(1.2345, 'ratio', 'en')).toBe('1.23');
    expect(formatValue(1234.5, 'currency', 'de')).toMatch(/^1\.234,50\s€$/);
  });

  it('a bucket is a short date; a week names its Monday and says +6', () => {
    expect(formatBucket('2026-11-02', 'daily', 'en')).toBe('Nov 2');
    expect(formatBucket('2026-11-02', 'weekly', 'en')).toBe('Nov 2 +6');
  });

  it('percent change against the previous period; null without one', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
    expect(formatPercent(20, 'en')).toBe('+20 %');
    expect(formatPercent(-12.34, 'en')).toBe('-12.3 %');
  });
});

import { describe, expect, it } from 'vitest';
import { pieArcs } from '../../src/series/pie';

describe('pieArcs', () => {
  it('lays the shares around the circle from twelve o’clock, clockwise, summing to 360 degrees', () => {
    const arcs = pieArcs([50, 30, 20]);

    expect(arcs.map((arc) => [arc.index, arc.startAngle, arc.endAngle])).toEqual([
      [0, 0, 180],
      [1, 180, 288],
      [2, 288, 360],
    ]);
    expect(arcs.reduce((sum, arc) => sum + (arc.endAngle - arc.startAngle), 0)).toBe(360);
  });

  it('draws one slice at 100 percent as a full circle, not as an arc', () => {
    const [arc] = pieArcs([100]);

    expect(arc).toMatchObject({ index: 0, startAngle: 0, endAngle: 360, full: true, path: null });
  });

  it('leaves a zero share out of the slices but keeps the indexes of the others', () => {
    const arcs = pieArcs([60, 0, 40]);

    expect(arcs.map((arc) => arc.index)).toEqual([0, 2]);
    expect(arcs.map((arc) => arc.full)).toEqual([false, false]);
    expect(arcs[1]).toMatchObject({ startAngle: 216, endAngle: 360 });
  });

  it('draws a path from the centre to the arc and back, with the large-arc flag past half', () => {
    const [big, small] = pieArcs([75, 25], { radius: 100, centre: 100 });

    expect(big!.path).toBe('M 100 100 L 100 0 A 100 100 0 1 1 0 100 Z');
    expect(small!.path).toBe('M 100 100 L 0 100 A 100 100 0 0 1 100 0 Z');
  });

  it('is empty without any share', () => {
    expect(pieArcs([])).toEqual([]);
    expect(pieArcs([0, 0])).toEqual([]);
  });

  it('normalises shares that do not add up to exactly 100', () => {
    const arcs = pieArcs([33.3, 33.3, 33.3]);

    expect(arcs[2]!.endAngle).toBe(360);
  });
});

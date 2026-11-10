export type ScaleKind = 'linear' | 'log';

interface Tick {
  value: number;
  y: number;
}

export interface YScale {
  kind: ScaleKind;
  /** pixel y of a value (values under the log floor sit on the baseline) */
  y(value: number): number;
  ticks: Tick[];
  domain: [number, number];
}

interface ScaleOptions {
  values: readonly number[];
  kind: ScaleKind;
  /** pixel y of the top of the plot */
  top: number;
  /** pixel y of the baseline */
  bottom: number;
}

/** Floor of the log axis: a count of 0 cannot be drawn on a log scale, so everything below 1 sits on the baseline. */
export const LOG_FLOOR = 1;

/** A "nice" step (1, 2, 5 × 10^n) so about `count` ticks cover [0, max]. */
export function niceStep(max: number, count = 5): number {
  if (max <= 0) {
    return 1;
  }
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function linearScale({ values, top, bottom }: ScaleOptions): YScale {
  const max = Math.max(0, ...values);
  const step = niceStep(max);
  const niceMax = max === 0 ? step : Math.ceil(max / step) * step;
  const span = bottom - top;
  const y = (value: number): number => bottom - (Math.max(0, value) / niceMax) * span;
  const ticks: Tick[] = [];
  for (let value = 0; value <= niceMax + step / 2; value += step) {
    ticks.push({ value, y: y(value) });
  }
  return { kind: 'linear', y, ticks, domain: [0, niceMax] };
}

function logScale({ values, top, bottom }: ScaleOptions): YScale {
  const max = Math.max(LOG_FLOOR * 10, ...values);
  const lo = Math.log10(LOG_FLOOR);
  const hi = Math.ceil(Math.log10(max));
  const span = bottom - top;
  const y = (value: number): number =>
    bottom - ((Math.log10(Math.max(LOG_FLOOR, value)) - lo) / (hi - lo)) * span;
  const ticks: Tick[] = [];
  const decades = hi - lo;
  for (let exponent = lo; exponent <= hi; exponent += 1) {
    const base = 10 ** exponent;
    ticks.push({ value: base, y: y(base) });
    // few decades: the 2 and 5 steps help reading the curve; many decades: powers of ten only
    if (decades <= 3 && exponent < hi) {
      for (const factor of [2, 5]) {
        ticks.push({ value: base * factor, y: y(base * factor) });
      }
    }
  }
  return { kind: 'log', y, ticks, domain: [LOG_FLOOR, 10 ** hi] };
}

export function createYScale(options: ScaleOptions): YScale {
  return options.kind === 'log' ? logScale(options) : linearScale(options);
}

/** Evenly spread x positions, first point at `left`, last at `right`; a single point sits in the middle. */
export function xPositions(count: number, left: number, right: number): number[] {
  if (count <= 1) {
    return count === 1 ? [(left + right) / 2] : [];
  }
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, at) => left + at * step);
}

/** The centres of `count` equal bands between `left` and `right`: where the bars of a bar chart stand. */
export function xCenters(count: number, left: number, right: number): number[] {
  if (count <= 0) {
    return [];
  }
  const step = (right - left) / count;
  return Array.from({ length: count }, (_, at) => left + (at + 0.5) * step);
}

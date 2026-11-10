export interface Point {
  x: number;
  y: number;
}

/** How the series is drawn: straight segments, the smooth curve, or one bar per bucket. */
export type ChartKind = 'linear' | 'curved' | 'bars';

export const CHART_KINDS: readonly ChartKind[] = ['linear', 'curved', 'bars'];

export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

const fixed = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * A smooth curve through every point: Catmull-Rom segments written as cubic Béziers (tension 1/6 of
 * the neighbour difference), so the line passes exactly through the data and bends gently between.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) {
    return '';
  }
  const [first] = points;
  let path = `M${fixed(first!.x)} ${fixed(first!.y)}`;
  if (points.length === 1) {
    return path;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C${fixed(c1.x)} ${fixed(c1.y)}, ${fixed(c2.x)} ${fixed(c2.y)}, ${fixed(p2.x)} ${fixed(p2.y)}`;
  }
  return path;
}

/** Straight segments from point to point. */
export function linearPath(points: readonly Point[]): string {
  return points
    .map((point, at) => `${at === 0 ? 'M' : 'L'}${fixed(point.x)} ${fixed(point.y)}`)
    .join(' ');
}

/** The line of a `linear` or `curved` chart (a bar chart has none). */
export function linePath(points: readonly Point[], kind: ChartKind): string {
  return kind === 'curved' ? smoothPath(points) : kind === 'linear' ? linearPath(points) : '';
}

/** The same line closed down to the baseline, for the 10 % wash under it. */
export function areaPath(
  points: readonly Point[],
  baseline: number,
  kind: ChartKind = 'curved',
): string {
  if (points.length < 2 || kind === 'bars') {
    return '';
  }
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${linePath(points, kind)} L${fixed(last.x)} ${fixed(baseline)} L${fixed(first.x)} ${fixed(baseline)} Z`;
}

/**
 * One bar per point: centred on its x, `ratio` of the slot wide (the slot is the distance between neighbours, the
 * whole plot for a single bar), from the point down to the baseline. A value on the baseline is a bar of height 0.
 */
export function bars(points: readonly Point[], baseline: number, slot: number, ratio = 0.6): Bar[] {
  const width = Math.max(1, slot * ratio);
  return points.map((point) => ({
    x: point.x - width / 2,
    y: Math.min(point.y, baseline),
    width,
    height: Math.max(0, baseline - point.y),
  }));
}

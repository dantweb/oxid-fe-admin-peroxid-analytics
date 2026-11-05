export interface Point {
  x: number;
  y: number;
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

/** The same curve closed down to the baseline, for the 10 % wash under the line. */
export function areaPath(points: readonly Point[], baseline: number): string {
  if (points.length < 2) {
    return '';
  }
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${smoothPath(points)} L${fixed(last.x)} ${fixed(baseline)} L${fixed(first.x)} ${fixed(baseline)} Z`;
}

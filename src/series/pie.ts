/**
 * The geometry of a pie: shares (percent) become slices that start at twelve o'clock and run clockwise. Pure
 * arithmetic, no DOM, so the angles are tested without a browser.
 */
export interface PieArc {
  /** index into the shares that were passed in (a zero share has no arc, the others keep their index) */
  index: number;
  /** degrees clockwise from twelve o'clock */
  startAngle: number;
  endAngle: number;
  /** one slice of the whole circle: an arc cannot start and end on the same point, a circle is drawn instead */
  full: boolean;
  /** the SVG path of the slice; null when `full` */
  path: string | null;
}

export interface PieGeometry {
  radius: number;
  centre: number;
}

const DEFAULT_GEOMETRY: PieGeometry = { radius: 100, centre: 100 };

const FULL_TURN = 360;
const HALF_TURN = 180;
const PRECISION = 1e6;

const round = (value: number): number => Math.round(value * PRECISION) / PRECISION;
const coordinate = (value: number): number => Math.round(value * 100) / 100 + 0;

function pointAt(angle: number, { radius, centre }: PieGeometry): string {
  const radians = (angle * Math.PI) / HALF_TURN;
  return `${coordinate(centre + radius * Math.sin(radians))} ${coordinate(centre - radius * Math.cos(radians))}`;
}

function pathOf(start: number, end: number, geometry: PieGeometry): string {
  const { radius, centre } = geometry;
  const large = end - start > HALF_TURN ? 1 : 0;
  return `M ${centre} ${centre} L ${pointAt(start, geometry)} A ${radius} ${radius} 0 ${large} 1 ${pointAt(end, geometry)} Z`;
}

/** Shares that do not add up to exactly 100 are scaled to the whole circle: the last slice always ends at 360. */
export function pieArcs(
  shares: readonly number[],
  geometry: PieGeometry = DEFAULT_GEOMETRY,
): PieArc[] {
  const sum = shares.reduce((total, share) => total + share, 0);
  if (sum <= 0) {
    return [];
  }
  const arcs: PieArc[] = [];
  let running = 0;
  const drawn = shares.filter((share) => share > 0).length;
  shares.forEach((share, index) => {
    if (share <= 0) {
      return;
    }
    const startAngle = round((running / sum) * FULL_TURN);
    running += share;
    const last = arcs.length === drawn - 1;
    const endAngle = last ? FULL_TURN : round((running / sum) * FULL_TURN);
    const full = drawn === 1;
    arcs.push({
      index,
      startAngle,
      endAngle,
      full,
      path: full ? null : pathOf(startAngle, endAngle, geometry),
    });
  });
  return arcs;
}

import type { MetricId, Unit } from './metrics';

/**
 * The curve "Share of top N products": the share (percent) that the period's top N products hold in each bucket. It is
 * not a metric of the series (it needs the shop's ranking, or the demo ranking, and the N of the products section), so
 * it has its own id next to the metrics.
 */
export const SHARE_CURVE = 'topShare';

export type CurveId = MetricId | typeof SHARE_CURVE;

export const SHARE_UNIT: Unit = 'percent';

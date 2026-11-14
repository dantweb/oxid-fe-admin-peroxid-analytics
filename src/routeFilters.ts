import { CHART_KINDS } from './series/curve';
import { METRICS } from './series/metrics';
import { SHARE_CURVE } from './series/shareCurve';
import type { AnalyticsFilters } from './useAnalytics';
import { RANGES } from './useAnalytics';

/**
 * The filters of the page as a route query, both ways: `?period=30` (or `from=…&to=…` for a custom period),
 * `granularity`, `curve`, `scale`, `chart`. A link shows the same data, and the admin assistant opens the page this way.
 * A value that is not allowed is ignored, so the filter keeps its default.
 */
export type QueryValue = string | null | (string | null)[] | undefined;

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const first = (value: QueryValue): string | undefined => {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' ? one : undefined;
};

const oneOf = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined =>
  allowed.find((entry) => entry === value);

function dayOf(text: string | undefined): number | undefined {
  const match = text === undefined ? null : DAY.exec(text);
  if (match === null) {
    return undefined;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? time : undefined;
}

/** Both days valid, `to` not before `from`, at most a year (the shop module's rule too). */
function customPeriod(query: Record<string, QueryValue>): { from: string; to: string } | undefined {
  const from = first(query.from);
  const to = first(query.to);
  const start = dayOf(from);
  const end = dayOf(to);
  if (from === undefined || to === undefined || start === undefined || end === undefined) {
    return undefined;
  }
  const days = (end - start) / DAY_MS + 1;
  return days >= 1 && days <= MAX_DAYS ? { from, to } : undefined;
}

const CURVES: readonly string[] = [...METRICS.map((metric) => metric.id), SHARE_CURVE];

export function filtersFromQuery(query: Record<string, QueryValue>): Partial<AnalyticsFilters> {
  const found: Partial<AnalyticsFilters> = {};
  const custom = customPeriod(query);
  const period = RANGES.find((days) => String(days) === first(query.period));
  if (custom !== undefined) {
    Object.assign(found, custom);
  } else if (period !== undefined) {
    Object.assign(found, { rangeDays: period, from: '', to: '' });
  }
  const granularity = oneOf(['daily', 'weekly'] as const, first(query.granularity));
  const metric = oneOf(CURVES as readonly AnalyticsFilters['metric'][], first(query.curve));
  const scale = oneOf(['linear', 'log'] as const, first(query.scale));
  const chart = oneOf(CHART_KINDS, first(query.chart));
  return {
    ...found,
    ...(granularity === undefined ? {} : { granularity }),
    ...(metric === undefined ? {} : { metric }),
    ...(scale === undefined ? {} : { scale }),
    ...(chart === undefined ? {} : { chart }),
  };
}

export function queryFromFilters(filters: AnalyticsFilters): Record<string, string> {
  const period: Record<string, string> =
    filters.from !== '' && filters.to !== ''
      ? { from: filters.from, to: filters.to }
      : { period: String(filters.rangeDays) };
  return {
    ...period,
    granularity: filters.granularity,
    curve: filters.metric,
    scale: filters.scale,
    chart: filters.chart,
  };
}

/** Writes the parts of `found` that differ into `filters`; the same values change nothing (no write loop). */
export function applyFilters(filters: AnalyticsFilters, found: Partial<AnalyticsFilters>): void {
  for (const [name, value] of Object.entries(found)) {
    if (filters[name as keyof AnalyticsFilters] !== value) {
      Object.assign(filters, { [name]: value });
    }
  }
}

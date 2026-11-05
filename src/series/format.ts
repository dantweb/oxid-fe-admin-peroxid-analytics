import type { Unit } from './metrics';
import type { Granularity } from './buckets';

/** Axis ticks are compact (12K), readouts in full (12,345). */
export function formatValue(value: number, unit: Unit, locale: string, compact = false): string {
  if (unit === 'currency') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: compact ? 0 : 2,
      minimumFractionDigits: compact ? 0 : 2,
      notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    }).format(value);
  }
  if (unit === 'ratio') {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: compact ? 0 : 2,
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
  }).format(value);
}

/** A bucket key (`YYYY-MM-DD`) as a short date; a weekly bucket is named by its Monday. */
export function formatBucket(key: string, granularity: Granularity, locale: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const text = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
  return granularity === 'weekly' ? `${text} +6` : text;
}

/** A signed percentage change; `null` when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function formatPercent(value: number, locale: string): string {
  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
  return `${text} %`;
}

import { addDays, startOfDay } from '../ecw/demoData';

export type Granularity = 'daily' | 'weekly';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` in local time (the bucket key is a calendar day, not an instant). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The Monday that starts the ISO week of `date`, as a local midnight. */
export function startOfIsoWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // Monday → 0 … Sunday → 6
  return addDays(day, -offset);
}

/** The key of the bucket a moment falls into: its day, or the Monday of its ISO week. */
export function bucketKey(date: Date, granularity: Granularity): string {
  return dayKey(granularity === 'weekly' ? startOfIsoWeek(date) : date);
}

/** The ordered bucket keys covering [from, to], so a bucket without data still shows as 0. */
export function bucketKeys(from: Date, to: Date, granularity: Granularity): string[] {
  const keys: string[] = [];
  const step = granularity === 'weekly' ? 7 : 1;
  let cursor = granularity === 'weekly' ? startOfIsoWeek(from) : startOfDay(from);
  const end = startOfDay(to);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(dayKey(cursor));
    cursor = addDays(cursor, step);
  }
  return keys;
}

/** The range of the last `days` days ending with `today` (both inclusive, local midnights). */
export function lastDays(today: Date, days: number): { from: Date; to: Date } {
  const to = startOfDay(today);
  return { from: addDays(to, -(Math.max(1, days) - 1)), to };
}

/** The range of the same length right before `range`, for a delta "vs the previous period". */
export function previousRange(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const length = Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

export function inRange(date: Date, range: { from: Date; to: Date }): boolean {
  const time = date.getTime();
  return time >= range.from.getTime() && time < addDays(range.to, 1).getTime();
}

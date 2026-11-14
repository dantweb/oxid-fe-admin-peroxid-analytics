import type { Granularity } from '../series/buckets';
import type { PopularSubject, RankMeasure } from '../series/ranking';

export const MIME = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

/** `analytics-<curve>-<granularity>-<from>_<to>.<ext>` */
export function seriesFileName(
  curve: string,
  granularity: Granularity,
  from: string,
  to: string,
  extension: string,
): string {
  return `analytics-${curve}-${granularity}-${from}_${to}.${extension}`;
}

/** `analytics-top-<products|categories>-<measure>-<from>_<to>.<ext>` */
export function rankingFileName(
  subject: PopularSubject,
  measure: RankMeasure,
  from: string,
  to: string,
  extension: string,
): string {
  return `analytics-top-${subject}-${measure}-${from}_${to}.${extension}`;
}

const REVOKE_AFTER_MS = 1000;

/**
 * Hands a file to the browser: a Blob behind an object URL and a clicked `<a download>`. It needs a user gesture (a
 * click, or the admin's `runUiAction` from one) to be allowed to download.
 */
export function downloadFile(name: string, content: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // the download has started when click() returns; the URL is freed a moment later
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

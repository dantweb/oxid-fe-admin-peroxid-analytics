import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, rankingFileName, seriesFileName } from '../../../src/export/download';

describe('file names', () => {
  it('names a curve export analytics-<curve>-<granularity>-<from>_<to>.<ext>', () => {
    expect(seriesFileName('newCustomers', 'daily', '2026-10-01', '2026-10-31', 'xlsx')).toBe(
      'analytics-newCustomers-daily-2026-10-01_2026-10-31.xlsx',
    );
  });

  it('names a ranking export analytics-top-<subject>-<measure>-<from>_<to>.<ext>', () => {
    expect(rankingFileName('products', 'units', '2026-10-01', '2026-10-31', 'csv')).toBe(
      'analytics-top-products-units-2026-10-01_2026-10-31.csv',
    );
  });
});

describe('downloadFile', () => {
  const created: Blob[] = [];
  const revoked: string[] = [];
  let clicked: HTMLAnchorElement | null = null;

  beforeEach(() => {
    created.length = 0;
    revoked.length = 0;
    clicked = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test/1';
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = this;
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clicks an anchor with the file name and the object URL, then removes it and frees the URL', () => {
    downloadFile('a.csv', 'x;y', 'text/csv;charset=utf-8');

    expect(clicked?.download).toBe('a.csv');
    expect(clicked?.href).toBe('blob:test/1');
    expect(created[0]!.type).toBe('text/csv;charset=utf-8');
    expect(created[0]!.size).toBe(3);
    expect(document.body.contains(clicked)).toBe(false);
    vi.runAllTimers();
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('takes bytes as well as text', () => {
    downloadFile('a.xlsx', new Uint8Array([1, 2, 3, 4]), 'application/zip');

    expect(created[0]!.size).toBe(4);
  });
});

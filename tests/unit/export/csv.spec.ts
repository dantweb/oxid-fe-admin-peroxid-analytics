import { describe, expect, it } from 'vitest';
import { toCsv } from '../../../src/export/csv';
import type { ExportTable } from '../../../src/export/table';

const table: ExportTable = {
  title: 'Sales, daily',
  demo: false,
  meta: ['ignored in a csv'],
  columns: [
    { label: 'Bucket', kind: 'text' },
    { label: 'Orders', kind: 'number' },
    { label: 'Sales', kind: 'money', currency: 'EUR' },
    { label: 'Orders per customer', kind: 'ratio' },
    { label: 'Share', kind: 'percent' },
  ],
  rows: [
    ['2026-11-02', 1234, 12345.5, 1.6667, 42.3],
    ['2026-11-03', 0, 0, 0, 0],
  ],
};
const BOM = '﻿';

describe('toCsv', () => {
  it('is RFC 4180 with CRLF lines, a BOM for Excel, plain numbers and the currency in the header only', () => {
    const csv = toCsv(table, { language: 'en', demoNote: 'Demo data' });

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Bucket,Orders,Sales (EUR),Orders per customer,Share (%)',
      '2026-11-02,1234,12345.5,1.6667,42.3',
      '2026-11-03,0,0,0,0',
      '',
    ]);
    expect(csv).not.toMatch(/[€$]/);
  });

  it('uses the semicolon and the decimal comma for German Excel', () => {
    const csv = toCsv(table, { language: 'de', demoNote: 'Demodaten' });

    expect(csv.slice(1).split('\r\n').slice(0, 2)).toEqual([
      'Bucket;Orders;Sales (EUR);Orders per customer;Share (%)',
      '2026-11-02;1234;12345,5;1,6667;42,3',
    ]);
  });

  it('puts the demo note in the first row when the numbers are generated', () => {
    const csv = toCsv({ ...table, demo: true }, { language: 'en', demoNote: 'Demo data' });

    expect(csv.slice(1).split('\r\n').slice(0, 2)).toEqual([
      'Demo data',
      'Bucket,Orders,Sales (EUR),Orders per customer,Share (%)',
    ]);
  });

  it('quotes a field with the separator, a quote or a line break and doubles the quotes', () => {
    const risky: ExportTable = {
      ...table,
      columns: [{ label: 'Title; "main"', kind: 'text' }],
      rows: [['Jeans, slim'], ['He said "hi"'], ['two\nlines'], ['semi;colon']],
    };

    expect(toCsv(risky, { language: 'en', demoNote: '' }).slice(1).split('\r\n')[0]).toBe(
      '"Title; ""main"""',
    );
    expect(toCsv(risky, { language: 'en', demoNote: '' })).toContain(
      '"Jeans, slim"\r\n"He said ""hi"""\r\n"two\nlines"\r\nsemi;colon\r\n',
    );
    expect(toCsv(risky, { language: 'de', demoNote: '' })).toContain('\r\n"semi;colon"\r\n');
  });

  it('defuses a text that a spreadsheet would run as a formula', () => {
    const hostile: ExportTable = {
      ...table,
      columns: [{ label: 'Title', kind: 'text' }],
      rows: [['=HYPERLINK("http://x")'], ['+1'], ['-1'], ['@SUM(A1)'], ['fine']],
    };

    const lines = toCsv(hostile, { language: 'en', demoNote: '' }).slice(1).split('\r\n');

    expect(lines.slice(1, 6)).toEqual([
      `"'=HYPERLINK(""http://x"")"`,
      "'+1",
      "'-1",
      "'@SUM(A1)",
      'fine',
    ]);
  });

  it('a negative number stays a number', () => {
    const negative: ExportTable = {
      ...table,
      columns: [{ label: 'Delta', kind: 'number' }],
      rows: [[-3]],
    };

    expect(toCsv(negative, { language: 'en', demoNote: '' })).toContain('\r\n-3\r\n');
  });
});

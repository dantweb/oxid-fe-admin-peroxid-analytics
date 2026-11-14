import { describe, expect, it } from 'vitest';
import { toXlsx } from '../../../src/export/xlsx';
import type { ExportTable } from '../../../src/export/table';
import { unzipStored } from './unzip';

const table: ExportTable = {
  title: 'Sales, daily',
  demo: false,
  meta: [],
  columns: [
    { label: 'Bucket', kind: 'text' },
    { label: 'Orders', kind: 'number' },
    { label: 'Sales', kind: 'money', currency: 'EUR' },
    { label: 'Share', kind: 'percent' },
  ],
  rows: [
    ['2026-11-02', 2, 40.5, 50],
    ['Jeans & <Shirts> "x"', 0, 0, 0],
  ],
};

const parts = (xlsx: Uint8Array): Map<string, string> =>
  new Map(unzipStored(xlsx).map((entry) => [entry.name, new TextDecoder().decode(entry.data)]));

describe('toXlsx', () => {
  it('is a ZIP with the five parts of a minimal workbook', () => {
    const files = parts(toXlsx(table, { demoNote: '' }));

    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(files.get('[Content_Types].xml')).toContain('spreadsheetml.sheet.main+xml');
    expect(files.get('_rels/.rels')).toContain('officeDocument');
    expect(files.get('xl/workbook.xml')).toContain(
      '<sheet name="Sales, daily" sheetId="1" r:id="rId1"/>',
    );
    expect(files.get('xl/_rels/workbook.xml.rels')).toContain('worksheets/sheet1.xml');
  });

  it('numbers are number cells, text is an inline string, money has the currency in the header', () => {
    const sheet = parts(toXlsx(table, { demoNote: '' })).get('xl/worksheets/sheet1.xml')!;

    expect(sheet).toContain(
      '<c r="A1" t="inlineStr"><is><t xml:space="preserve">Bucket</t></is></c>',
    );
    expect(sheet).toContain(
      '<c r="C1" t="inlineStr"><is><t xml:space="preserve">Sales (EUR)</t></is></c>',
    );
    expect(sheet).toContain(
      '<c r="D1" t="inlineStr"><is><t xml:space="preserve">Share (%)</t></is></c>',
    );
    expect(sheet).toContain('<c r="B2" t="n"><v>2</v></c>');
    expect(sheet).toContain('<c r="C2" t="n"><v>40.5</v></c>');
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">2026-11-02</t></is></c>',
    );
  });

  it('escapes XML in text and drops characters XML 1.0 cannot carry', () => {
    const hostile: ExportTable = { ...table, rows: [['a\u0000b & <c>', 1, 1, 1]] };

    const sheet = parts(toXlsx(hostile, { demoNote: '' })).get('xl/worksheets/sheet1.xml')!;

    expect(sheet).toContain('>ab &amp; &lt;c&gt;</t>');
    expect(sheet).not.toContain('\u0000');
  });

  it('puts the demo note in the first row, above the header', () => {
    const sheet = parts(toXlsx({ ...table, demo: true }, { demoNote: 'Demo data' })).get(
      'xl/worksheets/sheet1.xml',
    )!;

    expect(sheet).toContain(
      '<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">Demo data</t></is></c></row>',
    );
    expect(sheet).toContain(
      '<row r="2"><c r="A2" t="inlineStr"><is><t xml:space="preserve">Bucket</t>',
    );
  });

  it('names the sheet safely: at most 31 characters and none of []:*?/\\', () => {
    const named = toXlsx(
      { ...table, title: 'A/B: [very] long title that exceeds thirty-one characters?' },
      { demoNote: '' },
    );

    const workbook = parts(named).get('xl/workbook.xml')!;
    const name = /<sheet name="([^"]*)"/.exec(workbook)![1]!;

    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[[\]:*?/\\]/);
  });

  it('addresses columns past Z', () => {
    const wide: ExportTable = {
      ...table,
      columns: Array.from({ length: 28 }, (_, at) => ({
        label: `c${at}`,
        kind: 'number' as const,
      })),
      rows: [Array.from({ length: 28 }, (_, at) => at)],
    };

    const sheet = parts(toXlsx(wide, { demoNote: '' })).get('xl/worksheets/sheet1.xml')!;

    expect(sheet).toContain('<c r="AA2" t="n"><v>26</v></c>');
    expect(sheet).toContain('<c r="AB1"');
  });
});

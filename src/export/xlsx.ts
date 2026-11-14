import type { Cell, ExportColumn, ExportTable } from './table';
import { zipStored } from './zip';

/**
 * An XLSX (Office Open XML) with one sheet: the five parts of a minimal workbook in a stored ZIP, no dependency.
 * Numbers are number cells (sums and charts work in Excel), text is an inline string. A money column has its currency in
 * the header, a percent column "(%)". "XLS" in the admin's wish is this format: the current Excel format.
 */
export interface XlsxOptions {
  /** the first row when the numbers are generated */
  demoNote: string;
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAX_SHEET_NAME = 31;
const LETTERS = 26;

// XML 1.0 cannot carry most control characters, not even escaped
const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;

const escapeXml = (text: string): string =>
  text
    .replace(INVALID_XML, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** A, B … Z, AA, AB … */
function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / LETTERS)) {
    name = String.fromCharCode(65 + ((n - 1) % LETTERS)) + name;
  }
  return name;
}

const headerOf = (column: ExportColumn): string => {
  if (column.kind === 'money') {
    return `${column.label} (${column.currency})`;
  }
  return column.kind === 'percent' ? `${column.label} (%)` : column.label;
};

function cell(reference: string, value: Cell): string {
  if (typeof value === 'number') {
    return `<c r="${reference}" t="n"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(table: ExportTable, demoNote: string): string {
  const lines: Cell[][] = [
    ...(table.demo ? [[demoNote]] : []),
    table.columns.map(headerOf),
    ...table.rows,
  ];
  const rows = lines.map((line, at) => {
    const number = at + 1;
    const cells = line.map((value, column) => cell(`${columnName(column)}${number}`, value));
    return `<row r="${number}">${cells.join('')}</row>`;
  });
  return `${XML}<worksheet xmlns="${NS_MAIN}"><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

const sheetName = (title: string): string =>
  title
    .replace(/[[\]:*?/\\]/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME) || 'Sheet1';

export function toXlsx(table: ExportTable, { demoNote }: XlsxOptions): Uint8Array {
  const encoder = new TextEncoder();
  const part = (name: string, xml: string) => ({ name, data: encoder.encode(xml) });
  return zipStored([
    part(
      '[Content_Types].xml',
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ),
    part(
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS_PACKAGE_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    part(
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${escapeXml(sheetName(table.title))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    part(
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${NS_PACKAGE_REL}"><Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    part('xl/worksheets/sheet1.xml', sheetXml(table, demoNote)),
  ]);
}

import type { Cell, ExportColumn, ExportTable } from './table';

/**
 * CSV for Excel: RFC 4180 (CRLF lines, quotes doubled), UTF-8 with a BOM so that umlauts show right. A German admin
 * gets `;` and the decimal comma, which German Excel expects; every other language `,` and the decimal point.
 * Values are not formatted: no currency sign, no thousands separator. The currency is in the header of a money column.
 */
export interface CsvOptions {
  language: string;
  /** the first row when the numbers are generated (the page's demo note, in the admin's language) */
  demoNote: string;
}

const BOM = '﻿';
const LINE_BREAK = '\r\n';
const FORMULA_START = /^[=+\-@\t\r]/;

const headerOf = (column: ExportColumn): string => {
  if (column.kind === 'money') {
    return `${column.label} (${column.currency})`;
  }
  return column.kind === 'percent' ? `${column.label} (%)` : column.label;
};

export function toCsv(table: ExportTable, { language, demoNote }: CsvOptions): string {
  const german = language.toLowerCase().startsWith('de');
  const separator = german ? ';' : ',';
  const decimalMark = german ? ',' : '.';

  const escape = (text: string): string =>
    /["\r\n]/.test(text) || text.includes(separator) ? `"${text.replaceAll('"', '""')}"` : text;
  const cell = (value: Cell): string => {
    if (typeof value === 'number') {
      return String(value).replace('.', decimalMark);
    }
    // a text that starts like a formula is written as text (CSV injection)
    return escape(FORMULA_START.test(value) ? `'${value}` : value);
  };

  const lines = [
    ...(table.demo ? [escape(demoNote)] : []),
    table.columns.map((column) => escape(headerOf(column))).join(separator),
    ...table.rows.map((row) => row.map(cell).join(separator)),
  ];
  return BOM + lines.join(LINE_BREAK) + LINE_BREAK;
}

import { toCsv } from './csv';
import { downloadFile, MIME } from './download';
import type { ExportTable } from './table';
import { toXlsx } from './xlsx';

export type ExportFormat = 'xlsx' | 'csv';

/** Builds the file of a table in a format and hands it to the browser: one place for every export of the page. */
export function exportTable(
  table: ExportTable,
  format: ExportFormat,
  fileName: (extension: ExportFormat) => string,
  language: string,
  demoNote: string,
): void {
  if (format === 'csv') {
    downloadFile(fileName('csv'), toCsv(table, { language, demoNote }), MIME.csv);
    return;
  }
  downloadFile(fileName('xlsx'), toXlsx(table, { demoNote }), MIME.xlsx);
}

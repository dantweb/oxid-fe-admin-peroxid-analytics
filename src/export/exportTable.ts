import { toCsv } from './csv';
import { downloadFile, MIME } from './download';
import type { ExportTable } from './table';
import { toXlsx } from './xlsx';

/** The formats of a data file; a PDF also needs the chart image (`exportPdf`). */
export type FileFormat = 'xlsx' | 'csv';
export type ExportFormat = FileFormat | 'pdf';

/** Builds the file of a table in a format and hands it to the browser: one place for every export of the page. */
export function exportTable(
  table: ExportTable,
  format: FileFormat,
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

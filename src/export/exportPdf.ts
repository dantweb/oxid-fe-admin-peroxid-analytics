import { dayKey } from '../series/buckets';
import type { ChartPng } from './chartImage';
import { downloadFile, MIME } from './download';
import { toPdf } from './pdf';
import type { ExportTable } from './table';

export interface PdfTexts {
  locale: string;
  demoNote: string;
  /** "Created {date} by peroxid-admin analytics" with the date put in */
  created: (date: string) => string;
  pageOf: (page: number, pages: number) => string;
}

/** Builds the PDF of a table with the chart image and hands it to the browser. */
export async function exportPdf(
  table: ExportTable,
  image: ChartPng | null,
  fileName: string,
  texts: PdfTexts,
): Promise<void> {
  const bytes = await toPdf(table, {
    locale: texts.locale,
    demoNote: texts.demoNote,
    created: texts.created(dayKey(new Date())),
    pageOf: texts.pageOf,
    image,
  });
  downloadFile(fileName, bytes, MIME.pdf);
}

import { formatCell, type ExportTable } from './table';

/**
 * A PDF of a table: A4 landscape, the title and the meta lines (period, curve, source) on top, the demo note when the
 * numbers are generated, the chart as an image, the table with its header on every page, and a footer on every page
 * ("Created … by peroxid-admin analytics", "Page x of y"). `jspdf` is loaded only here, when an admin exports, so the page
 * does not carry it until then.
 */
interface PdfImage {
  /** `data:image/png;base64,…` */
  dataUrl: string;
  width: number;
  height: number;
}

/** The part of jsPDF this module uses; the tests hand in a recorder. */
export interface JsPdfLike {
  setFont(name: string, style?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(...channels: number[]): unknown;
  setDrawColor(...channels: number[]): unknown;
  setFillColor(...channels: number[]): unknown;
  rect(x: number, y: number, width: number, height: number, style?: string): unknown;
  getTextWidth(text: string): number;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  text(
    text: string,
    x: number,
    y: number,
    options?: { align?: 'left' | 'right' | 'center' },
  ): unknown;
  addImage(
    data: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): unknown;
  addPage(): unknown;
  setPage(page: number): unknown;
  getNumberOfPages(): number;
  splitTextToSize(text: string, width: number): string[];
  output(type: 'arraybuffer'): ArrayBuffer;
}

interface JsPdfModule {
  jsPDF: new (options: { orientation: 'landscape'; unit: 'mm'; format: 'a4' }) => JsPdfLike;
}

/** One line of the legend of a ranking: the slice's colour and what it stands for. */
export interface PdfLegendEntry {
  colour: [number, number, number];
  /** "1", "2" … ; empty for "Others" */
  rank: string;
  title: string;
  valueText: string;
  shareText: string;
}

export interface PdfOptions {
  locale: string;
  demoNote: string;
  /** the footer's left text, e.g. "Created 2026-11-14 by peroxid-admin analytics" */
  created: string;
  pageOf: (page: number, pages: number) => string;
  image: PdfImage | null;
  /** the legend of the chart (ranking PDFs): a line per slice, next to the image */
  legend?: PdfLegendEntry[];
  /** how jspdf is loaded; the default is the dynamic import */
  load?: () => Promise<JsPdfModule>;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const CONTENT_BOTTOM = PAGE_HEIGHT - 16;
const FOOTER_Y = PAGE_HEIGHT - 8;
const ROW_HEIGHT = 6;
const IMAGE_MAX_HEIGHT = 80;
const GREY = 100;

const loadJsPdf = (): Promise<JsPdfModule> => import('jspdf');

function drawHeader(doc: JsPdfLike, table: ExportTable, options: PdfOptions): number {
  let y = MARGIN + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(table.title, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(GREY);
  for (const line of table.meta) {
    y += 5.5;
    doc.text(line, MARGIN, y);
  }
  if (table.demo) {
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.text(options.demoNote, MARGIN, y);
    doc.setFont('helvetica', 'normal');
  }
  return y + 5;
}

const IMAGE_WITH_LEGEND_WIDTH = 120;
const IMAGE_WITH_LEGEND_HEIGHT = 100;
const LEGEND_GAP = 8;
const LEGEND_MAX_LINE = 5.5;
const SWATCH = 3;
const ELLIPSIS = '…';

/** The text, cut with an ellipsis until it fits the width. */
function fitted(doc: JsPdfLike, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + ELLIPSIS) > width) {
    cut = cut.slice(0, -1);
  }
  return cut.trimEnd() + ELLIPSIS;
}

/** One line per slice: a swatch in the slice's colour, "rank. title" and, at the right edge, "value · share". */
function drawLegend(doc: JsPdfLike, legend: PdfLegendEntry[], x: number, top: number): number {
  const width = PAGE_WIDTH - MARGIN - x;
  const lineHeight = Math.min(LEGEND_MAX_LINE, IMAGE_WITH_LEGEND_HEIGHT / legend.length);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const figures = legend.map((entry) => `${entry.valueText} · ${entry.shareText}`);
  const figureWidth = Math.max(...figures.map((text) => doc.getTextWidth(text)));
  legend.forEach((entry, at) => {
    const y = top + at * lineHeight;
    doc.setFillColor(...entry.colour);
    doc.rect(x, y - SWATCH + 0.4, SWATCH, SWATCH, 'F');
    doc.setTextColor(0);
    const title = entry.rank === '' ? entry.title : `${entry.rank}. ${entry.title}`;
    doc.text(fitted(doc, title, width - SWATCH - 3 - figureWidth - 3), x + SWATCH + 2, y);
    doc.text(figures[at]!, x + width, y, { align: 'right' });
  });
  return legend.length * lineHeight;
}

/** The chart image and, next to it, the legend; the table starts below whichever is taller. */
function drawChart(doc: JsPdfLike, options: PdfOptions, y: number): number {
  const legend = options.legend ?? [];
  const { image } = options;
  let imageHeight = 0;
  let imageRight = MARGIN;
  if (image !== null) {
    const ratio = image.height / image.width;
    const maxWidth = legend.length > 0 ? IMAGE_WITH_LEGEND_WIDTH : CONTENT_WIDTH;
    const maxHeight = legend.length > 0 ? IMAGE_WITH_LEGEND_HEIGHT : IMAGE_MAX_HEIGHT;
    const height = Math.min(maxHeight, maxWidth * ratio);
    const width = height / ratio;
    doc.addImage(image.dataUrl, 'PNG', MARGIN, y, width, height);
    imageHeight = height;
    imageRight = MARGIN + width + LEGEND_GAP;
  }
  const legendHeight = legend.length > 0 ? drawLegend(doc, legend, imageRight, y + 4) : 0;
  return y + Math.max(imageHeight, legendHeight) + 5;
}

function drawRow(
  doc: JsPdfLike,
  cells: string[],
  numeric: boolean[],
  columnWidth: number,
  y: number,
): void {
  cells.forEach((cell, at) => {
    const text = doc.splitTextToSize(cell, columnWidth - 2)[0] ?? '';
    const left = MARGIN + at * columnWidth;
    if (numeric[at]) {
      doc.text(text, left + columnWidth - 1, y, { align: 'right' });
    } else {
      doc.text(text, left + 1, y);
    }
  });
}

function drawTable(doc: JsPdfLike, table: ExportTable, locale: string, startY: number): void {
  const columnWidth = CONTENT_WIDTH / table.columns.length;
  const numeric = table.columns.map((column) => column.kind !== 'text');
  const heading = (y: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0);
    drawRow(
      doc,
      table.columns.map((column) => column.label),
      numeric,
      columnWidth,
      y,
    );
    doc.setDrawColor(GREY);
    doc.line(MARGIN, y + 1.5, MARGIN + CONTENT_WIDTH, y + 1.5);
    doc.setFont('helvetica', 'normal');
    return y + ROW_HEIGHT;
  };
  let y = heading(startY);
  for (const row of table.rows) {
    if (y > CONTENT_BOTTOM) {
      doc.addPage();
      y = heading(MARGIN + 4);
    }
    drawRow(
      doc,
      row.map((cell, at) => formatCell(cell, table.columns[at]!, locale)),
      numeric,
      columnWidth,
      y,
    );
    y += ROW_HEIGHT;
  }
}

function drawFooters(doc: JsPdfLike, options: PdfOptions): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GREY);
    doc.text(options.created, MARGIN, FOOTER_Y);
    doc.text(options.pageOf(page, pages), PAGE_WIDTH - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

export async function toPdf(table: ExportTable, options: PdfOptions): Promise<Uint8Array> {
  const { jsPDF } = await (options.load ?? loadJsPdf)();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawHeader(doc, table, options);
  y = drawChart(doc, options, y);
  drawTable(doc, table, options.locale, y);
  drawFooters(doc, options);
  return new Uint8Array(doc.output('arraybuffer'));
}

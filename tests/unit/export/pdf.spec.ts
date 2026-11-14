import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  toPdf,
  type JsPdfLike,
  type PdfLegendEntry,
  type PdfOptions,
} from '../../../src/export/pdf';
import type { ExportTable } from '../../../src/export/table';

/** A jsPDF stand-in that records what is drawn: the layout is tested without a PDF reader. */
class FakePdf implements JsPdfLike {
  static last: FakePdf;
  texts: { text: string; x: number; y: number; page: number; align?: string }[] = [];
  images: { page: number; width: number; height: number; format: string }[] = [];
  pages = 1;
  current = 1;
  constructor(readonly options: { orientation: 'landscape'; unit: 'mm'; format: 'a4' }) {
    FakePdf.last = this;
  }
  setFont(): this {
    return this;
  }
  setFontSize(): this {
    return this;
  }
  setTextColor(): this {
    return this;
  }
  setDrawColor(): this {
    return this;
  }
  fills: { colour: number[]; x: number; y: number; page: number }[] = [];
  private fill: number[] = [];
  setFillColor(...channels: number[]): this {
    this.fill = channels;
    return this;
  }
  rect(x: number, y: number): this {
    this.fills.push({ colour: this.fill, x, y, page: this.current });
    return this;
  }
  getTextWidth(text: string): number {
    return text.length * 1.6;
  }
  line(): this {
    return this;
  }
  text(text: string, x: number, y: number, options?: { align?: string }): this {
    this.texts.push({ text, x, y, page: this.current, align: options?.align });
    return this;
  }
  addImage(
    _data: string,
    format: string,
    _x: number,
    _y: number,
    width: number,
    height: number,
  ): this {
    this.images.push({ page: this.current, width, height, format });
    return this;
  }
  addPage(): this {
    this.pages += 1;
    this.current = this.pages;
    return this;
  }
  setPage(page: number): this {
    this.current = page;
    return this;
  }
  getNumberOfPages(): number {
    return this.pages;
  }
  splitTextToSize(text: string): string[] {
    return [text];
  }
  output(): ArrayBuffer {
    return new TextEncoder().encode('%PDF-fake').buffer as ArrayBuffer;
  }
}

const table = (rows: number): ExportTable => ({
  title: 'Sales, daily',
  demo: false,
  meta: ['Period: 2026-10-01 – 2026-10-31', 'Granularity: Daily'],
  columns: [
    { label: 'Bucket', kind: 'text' },
    { label: 'Orders', kind: 'number' },
    { label: 'Sales', kind: 'money', currency: 'EUR' },
  ],
  rows: Array.from({ length: rows }, (_, at) => [
    `2026-10-${String((at % 28) + 1).padStart(2, '0')}`,
    at,
    at * 10.5,
  ]),
});

const options = (extra: Partial<PdfOptions> = {}): PdfOptions => ({
  locale: 'en',
  demoNote: 'Demo data: generated in the browser, not the numbers of the shop.',
  created: 'Created 2026-11-14 by peroxid-admin analytics',
  pageOf: (page, pages) => `Page ${page} of ${pages}`,
  image: null,
  load: async () => ({ jsPDF: FakePdf }),
  ...extra,
});

const textsOnPage = (page: number): string[] =>
  FakePdf.last.texts.filter((t) => t.page === page).map((t) => t.text);

describe('toPdf', () => {
  it('is an A4 landscape document in millimetres and returns the bytes', async () => {
    const bytes = await toPdf(table(3), options());

    expect(FakePdf.last.options).toMatchObject({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    expect(new TextDecoder().decode(bytes)).toBe('%PDF-fake');
  });

  it('writes the title and the meta lines (period, granularity …) at the top of the first page', async () => {
    await toPdf(table(3), options());

    expect(textsOnPage(1).slice(0, 3)).toEqual([
      'Sales, daily',
      'Period: 2026-10-01 – 2026-10-31',
      'Granularity: Daily',
    ]);
  });

  it('adds the demo note only for demo data', async () => {
    await toPdf(table(3), options());
    expect(textsOnPage(1).some((text) => text.startsWith('Demo data'))).toBe(false);

    await toPdf({ ...table(3), demo: true }, options());
    expect(textsOnPage(1).some((text) => text.startsWith('Demo data'))).toBe(true);
  });

  it('places the chart image as a PNG on the first page, scaled into the page, when there is one', async () => {
    await toPdf(
      table(3),
      options({ image: { dataUrl: 'data:image/png;base64,AAAA', width: 2000, height: 800 } }),
    );

    expect(FakePdf.last.images).toHaveLength(1);
    expect(FakePdf.last.images[0]).toMatchObject({ page: 1, format: 'PNG' });
    expect(FakePdf.last.images[0]!.width).toBeLessThanOrEqual(273);
    expect(FakePdf.last.images[0]!.height / FakePdf.last.images[0]!.width).toBeCloseTo(0.4, 2);
    await toPdf(table(3), options());
    expect(FakePdf.last.images).toHaveLength(0);
  });

  it('writes the header and every row of the table, formatted as the page shows it', async () => {
    await toPdf(table(4), options());

    const all = FakePdf.last.texts.map((t) => t.text);
    expect(all).toEqual(expect.arrayContaining(['Bucket', 'Orders', 'Sales']));
    expect(all).toContain('2026-10-04');
    expect(all).toContain('€31.50');
    expect(all.filter((text) => /^2026-10-\d\d$/.test(text))).toHaveLength(4);
  });

  it('breaks the table onto more pages and repeats the header on each', async () => {
    await toPdf(table(120), options());

    expect(FakePdf.last.pages).toBeGreaterThan(1);
    for (let page = 1; page <= FakePdf.last.pages; page += 1) {
      expect(textsOnPage(page)).toContain('Bucket');
    }
    const rowsWritten = FakePdf.last.texts.filter((t) => /^2026-10-\d\d$/.test(t.text));
    expect(rowsWritten).toHaveLength(120);
    expect(Math.max(...FakePdf.last.texts.map((t) => t.y))).toBeLessThanOrEqual(210);
  });

  it('puts the footer on every page: when it was created and "page x of y"', async () => {
    await toPdf(table(120), options());

    const pages = FakePdf.last.pages;
    for (let page = 1; page <= pages; page += 1) {
      expect(textsOnPage(page)).toContain('Created 2026-11-14 by peroxid-admin analytics');
      expect(textsOnPage(page)).toContain(`Page ${page} of ${pages}`);
    }
  });

  it('loads jspdf only when a PDF is made: no static import in the module', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/export/pdf.ts'), 'utf-8');

    expect(source).not.toMatch(/^import[^;]*from 'jspdf'/m);
    expect(source).toContain("import('jspdf')");
  });

  describe('the legend of a ranking', () => {
    const entry = (at: number, title = `Product number ${at}`): PdfLegendEntry => ({
      colour: [at * 10, 100, 200 - at],
      rank: String(at + 1),
      title,
      valueText: `€${at * 100}.00`,
      shareText: `${at}.5 %`,
    });
    const legend = (count: number): PdfLegendEntry[] =>
      Array.from({ length: count }, (_, at) => entry(at));
    const image = { dataUrl: 'data:image/png;base64,AAAA', width: 800, height: 800 };

    it('has one line per slice: a swatch in the slice colour, rank and title, value and share', async () => {
      await toPdf(table(3), options({ image, legend: legend(3) }));

      expect(FakePdf.last.fills.map((fill) => fill.colour)).toEqual([
        [0, 100, 200],
        [10, 100, 199],
        [20, 100, 198],
      ]);
      const all = textsOnPage(1);
      expect(all).toEqual(
        expect.arrayContaining([
          '1. Product number 0',
          '2. Product number 1',
          '3. Product number 2',
        ]),
      );
      expect(all).toEqual(expect.arrayContaining(['€100.00 · 1.5 %', '€200.00 · 2.5 %']));
    });

    it('stands next to the image, not on it, and each swatch sits on the line of its text', async () => {
      await toPdf(table(3), options({ image, legend: legend(3) }));

      const imageRight = 12 + FakePdf.last.images[0]!.width;
      expect(Math.min(...FakePdf.last.fills.map((fill) => fill.x))).toBeGreaterThan(imageRight);
      const line = FakePdf.last.texts.find((t) => t.text === '2. Product number 1')!;
      expect(Math.abs(FakePdf.last.fills[1]!.y + 2.6 - line.y)).toBeLessThan(0.5);
    });

    it('shortens a long title with an ellipsis so that it stays in its column', async () => {
      const long =
        'Organic Cotton T-Shirt with a very long product title that has to wrap on a narrow screen';

      await toPdf(table(3), options({ image, legend: [entry(0, long)] }));

      const line = FakePdf.last.texts.find((t) => t.text.startsWith('1. Organic'))!;
      expect(line.text.endsWith('…')).toBe(true);
      expect(line.text.length).toBeLessThan(long.length);
      const figureWidth = FakePdf.last.getTextWidth('€0.00 · 0.5 %');
      expect(line.x + FakePdf.last.getTextWidth(line.text)).toBeLessThanOrEqual(
        297 - 12 - figureWidth,
      );
    });

    it('holds 20 items and Others on the first page, all inside the page', async () => {
      const entries = [...legend(20), { ...entry(20, 'Others'), rank: '' }];

      await toPdf(table(5), options({ image, legend: entries }));

      expect(FakePdf.last.fills).toHaveLength(21);
      expect(FakePdf.last.fills.every((fill) => fill.page === 1)).toBe(true);
      expect(textsOnPage(1)).toContain('Others');
      for (let at = 0; at < 20; at += 1) {
        expect(textsOnPage(1)).toContain(`${at + 1}. Product number ${at}`);
      }
      expect(Math.max(...FakePdf.last.fills.map((fill) => fill.y))).toBeLessThan(194);
    });

    it('is full width without an image, and absent without entries', async () => {
      await toPdf(table(3), options({ image: null, legend: legend(2) }));
      expect(Math.min(...FakePdf.last.fills.map((fill) => fill.x))).toBe(12);

      await toPdf(table(3), options({ image, legend: [] }));
      expect(FakePdf.last.fills).toHaveLength(0);
    });
  });
});

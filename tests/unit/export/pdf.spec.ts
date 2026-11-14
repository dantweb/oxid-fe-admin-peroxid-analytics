import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPdf, type JsPdfLike, type PdfOptions } from '../../../src/export/pdf';
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
});

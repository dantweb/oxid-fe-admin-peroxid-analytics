import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';
import { unzipStored } from '../tests/unit/export/unzip';

/**
 * The export of the analytics page (Sprint 38), against the harness page and a stand-in shop: every place with its
 * formats, the files themselves (CSV text, XLSX opened by unzip, number cells), the keyboard, the admin's UI action
 * handlers, and axe with a menu open in the light and the dark theme at 1280 and 360 px. A PDF export needs the `jspdf`
 * dependency and is not part of this suite yet. With `E2E_SCREENSHOTS=<dir>` it writes the screenshots.
 */
const PLACES = [
  {
    id: 'chart',
    file: /^analytics-sales-daily-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\./,
    items: 'data table',
  },
  {
    id: 'table',
    file: /^analytics-sales-daily-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\./,
    items: 'data table',
  },
  { id: 'top_products', file: /^analytics-top-products-sales-/, items: 'ranked list' },
  { id: 'top_categories', file: /^analytics-top-categories-sales-/, items: 'ranked list' },
] as const;
const FORMATS = ['csv', 'xlsx'] as const;

const open = async (page: Page, params = 'source=live'): Promise<void> => {
  await page.goto(`/?${params}`);
  await expect(page.getByTestId('popular-products')).toBeVisible();
};
const menu = (page: Page, id: string) => page.locator(`[data-field="analytics.export.${id}"]`);

async function bytesOf(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFileSync(path);
}

async function exportFrom(page: Page, id: string, format: string): Promise<Download> {
  await menu(page, id).getByTestId('export-button').click();
  const waiting = page.waitForEvent('download');
  await menu(page, id).getByTestId(`export-${format}`).click();
  return waiting;
}

test.describe('every place exports every format', () => {
  for (const place of PLACES) {
    for (const format of FORMATS) {
      test(`${place.id} as ${format}`, async ({ page }) => {
        await open(page);

        const download = await exportFrom(page, place.id, format);
        const bytes = await bytesOf(download);

        expect(download.suggestedFilename()).toMatch(place.file);
        expect(download.suggestedFilename().endsWith(`.${format}`)).toBe(true);
        expect(bytes.length).toBeGreaterThan(0);
        if (format === 'csv') {
          const text = bytes.toString('utf-8');
          expect(text.startsWith('﻿')).toBe(true);
          expect(text).toContain('\r\n');
          expect(text).not.toMatch(/[€$]/);
          expect(text.split('\r\n')[0]).not.toContain('Demo data'); // the shop's numbers: no demo row
          return;
        }
        const entries = unzipStored(new Uint8Array(bytes));
        expect(entries.map((entry) => entry.name)).toContain('xl/worksheets/sheet1.xml');
        const sheet = new TextDecoder().decode(
          entries.find((entry) => entry.name === 'xl/worksheets/sheet1.xml')!.data,
        );
        expect(sheet).toMatch(/<c r="[B-E]2" t="n"><v>[\d.]+<\/v><\/c>/);
      });
    }
  }
});

test.describe('the files hold what the page shows', () => {
  test('the chart CSV has one row per day of the table and the same numbers', async ({ page }) => {
    await open(page);
    await page.getByTestId('analytics-table').locator('summary').click();
    const visible = await page.getByTestId('table-row').count();

    const download = await exportFrom(page, 'chart', 'csv');
    const lines = (await bytesOf(download))
      .toString('utf-8')
      .replace('﻿', '')
      .split('\r\n')
      .filter(Boolean);

    expect(lines).toHaveLength(visible + 1);
    expect(lines[0]).toContain('Sales (EUR)');
    const firstRow = page.getByTestId('table-row').first();
    const shownOrders = Number(
      (await firstRow.locator('td').first().innerText()).replace(/\D/g, ''),
    );
    expect(Number(lines[1]!.split(',')[1])).toBe(shownOrders);
  });

  test('the demo source says so in the first row', async ({ page }) => {
    await open(page, '');

    const download = await exportFrom(page, 'table', 'csv');

    expect((await bytesOf(download)).toString('utf-8')).toContain(
      'Demo data: generated in the browser',
    );
  });

  test('the ranking CSV lists the items, then Others, and the shares add up to 100', async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId('popular-products').getByTestId('popular-topn').selectOption('10');

    const download = await exportFrom(page, 'top_products', 'csv');
    const lines = (await bytesOf(download))
      .toString('utf-8')
      .replace('﻿', '')
      .split('\r\n')
      .filter(Boolean);

    expect(lines[0]).toBe('Rank,Product,Article number,Sales (EUR),Share (%)');
    expect(lines).toHaveLength(1 + 10 + 1);
    expect(lines.at(-1)).toMatch(/^,Others,,/);
    const shares = lines.slice(1).map((line) => Number(line.split(',').at(-1)));
    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 10)).toBe(1000);
  });

  test('a German admin gets the semicolon, the decimal comma and German headers', async ({
    page,
  }) => {
    await open(page, 'source=live&lang=de');

    const download = await exportFrom(page, 'chart', 'csv');
    const [header, first] = (await bytesOf(download))
      .toString('utf-8')
      .replace('﻿', '')
      .split('\r\n');

    expect(header).toContain('Bestellungen;Umsatz (EUR)');
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2};\d+;\d+(,\d+)?;/);
  });
});

test.describe('the menu', () => {
  test('opens from the keyboard, walks the items, closes on Escape and returns the focus', async ({
    page,
  }) => {
    await open(page);
    const button = menu(page, 'chart').getByTestId('export-button');

    await button.focus();
    await page.keyboard.press('ArrowDown');
    await expect(
      menu(page, 'chart').getByRole('menuitem', { name: 'XLSX — data table' }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      menu(page, 'chart').getByRole('menuitem', { name: 'CSV — data table' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(menu(page, 'chart').getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test('has an accessible name at each place and no PDF where PDF is not offered', async ({
    page,
  }) => {
    await open(page);

    await expect(
      menu(page, 'chart').getByRole('button', { name: 'Export chart and data' }),
    ).toBeVisible();
    await expect(menu(page, 'table').getByRole('button', { name: 'Export table' })).toBeVisible();
    await menu(page, 'table').getByTestId('export-button').click();
    await expect(menu(page, 'table').getByRole('menuitem')).toHaveText([
      'XLSX — data table',
      'CSV — data table',
    ]);
  });
});

test.describe('the admin runs a page action', () => {
  test('analytics.export.table with a period, granularity and format exports that view', async ({
    page,
  }) => {
    await open(page);

    const waiting = page.waitForEvent('download');
    await page.evaluate(() =>
      window.__uiActions.get('analytics.export.table')!({
        format: 'csv',
        from: '2026-10-01',
        to: '2026-10-31',
        granularity: 'weekly',
      }),
    );
    const download = await waiting;

    expect(download.suggestedFilename()).toBe('analytics-sales-weekly-2026-10-01_2026-10-31.csv');
    const lines = (await bytesOf(download))
      .toString('utf-8')
      .replace('﻿', '')
      .split('\r\n')
      .filter(Boolean);
    expect(lines).toHaveLength(1 + 5); // header + the weeks of Sep 28, Oct 5, 12, 19, 26
    expect(await page.getByTestId('filter-granularity').inputValue()).toBe('weekly');
  });

  test('analytics.export.top_categories with limit and measure exports that ranking', async ({
    page,
  }) => {
    await open(page);

    const waiting = page.waitForEvent('download');
    await page.evaluate(() =>
      window.__uiActions.get('analytics.export.top_categories')!({
        format: 'xlsx',
        limit: '3',
        measure: 'units',
      }),
    );
    const download = await waiting;

    expect(download.suggestedFilename()).toMatch(/^analytics-top-categories-units-/);
    await expect(page.getByTestId('popular-categories').getByTestId('popular-topn')).toHaveValue(
      '3',
    );
    const sheet = unzipStored(new Uint8Array(await bytesOf(download))).find(
      (entry) => entry.name === 'xl/worksheets/sheet1.xml',
    )!;
    expect((new TextDecoder().decode(sheet.data).match(/<row /g) ?? []).length).toBe(1 + 3 + 1);
  });
});

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { name: '1280', width: 1280, height: 900 },
    { name: '360', width: 360, height: 780 },
  ]) {
    test.describe(`${theme} theme at ${viewport.name} px`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('axe finds nothing with the chart menu and the ranking menu open, no sideways scroll', async ({
        page,
      }) => {
        await open(page, `theme=${theme}&source=live`);
        await page.getByTestId('analytics-table').locator('summary').click();

        for (const id of ['chart', 'table', 'top_products']) {
          await menu(page, id).getByTestId('export-button').click();
          const { violations } = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            violations.map(
              (violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`,
            ),
          ).toEqual([]);
          if (id === 'chart') {
            await shot(
              page,
              `38-export-menu-open-${theme}-${viewport.name}.png`,
              'analytics-chart-card',
            );
          }
          await page.keyboard.press('Escape');
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await shot(page, `38-export-icons-${theme}-${viewport.name}.png`, 'analytics-chart-card');
      });
    });
  }
}

async function shot(page: Page, name: string, testId: string): Promise<void> {
  const directory = process.env.E2E_SCREENSHOTS;
  if (directory === undefined) {
    return;
  }
  mkdirSync(directory, { recursive: true });
  await page.getByTestId(testId).screenshot({ path: resolve(directory, name) });
}

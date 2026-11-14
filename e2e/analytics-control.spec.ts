import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';

/**
 * The assistant controls the whole analytics page (Sprint 40): the two view actions and the exports are run through the
 * handlers that the page registers (the harness keeps them, as the admin's `registerUiAction` does), and the page state
 * must equal the args. Also: a link with the whole state in its query, the owner's case (the PDF of the top 3
 * categories as bars, with the legend), and axe in both themes. `E2E_SCREENSHOTS=<dir>` writes the screenshots.
 */
const open = async (page: Page, params = 'source=live'): Promise<void> => {
  await page.goto(`/?${params}`);
  await expect(page.getByTestId('popular-products')).toBeVisible();
};
const run = (page: Page, id: string, args: Record<string, unknown>) =>
  page.evaluate(
    ([actionId, actionArgs]) => window.__uiActions.get(actionId as string)!(actionArgs as never),
    [id, args],
  );
const select = (page: Page, testId: string, within = '') =>
  page.locator(`${within} [data-test="${testId}"]`).first();
const section = (page: Page, subject: string) => page.getByTestId(`popular-${subject}`);

async function shot(page: Page, name: string, testId?: string): Promise<void> {
  const directory = process.env.E2E_SCREENSHOTS;
  if (directory === undefined) {
    return;
  }
  mkdirSync(directory, { recursive: true });
  const target = testId === undefined ? page : page.getByTestId(testId);
  await target.screenshot({ path: resolve(directory, name) });
}

test.describe('analytics.show', () => {
  test('sets every filter, the chart type and the table: the page equals the args', async ({
    page,
  }) => {
    await open(page);

    await run(page, 'analytics.show', {
      period: '90',
      granularity: 'weekly',
      curve: 'customers',
      scale: 'log',
      chart: 'bars',
      table: 'open',
    });

    await expect(select(page, 'filter-range')).toHaveValue('90');
    await expect(select(page, 'filter-granularity')).toHaveValue('weekly');
    await expect(select(page, 'filter-metric')).toHaveValue('customers');
    await expect(select(page, 'filter-scale')).toHaveValue('log');
    await expect(select(page, 'filter-chart')).toHaveValue('bars');
    await expect(page.getByTestId('analytics-table')).toHaveJSProperty('open', true);
    await expect(page.getByTestId('chart-title')).toHaveText('New customers, weekly');
  });

  test('a custom period and the share curve', async ({ page }) => {
    await open(page);

    await run(page, 'analytics.show', { from: '2026-10-01', to: '2026-10-31', curve: 'topShare' });

    await expect(select(page, 'filter-range')).toHaveValue('custom');
    await expect(select(page, 'filter-metric')).toHaveValue('topShare');
    await expect(page.getByTestId('chart-title')).toContainText('Share of top 5 products');
  });
});

test.describe('analytics.popular.show', () => {
  test('sets the categories section to top 3 as bars and scrolls to it', async ({ page }) => {
    await open(page);

    await run(page, 'analytics.popular.show', { subject: 'categories', limit: 3, chart: 'bars' });

    await expect(select(page, 'popular-topn', '[data-test="popular-categories"]')).toHaveValue('3');
    await expect(select(page, 'popular-chart', '[data-test="popular-categories"]')).toHaveValue(
      'bars',
    );
    await expect(section(page, 'categories').getByTestId('rank-bar')).toHaveCount(4); // 3 and Others
    await expect(select(page, 'popular-topn', '[data-test="popular-products"]')).toHaveValue('5');
    await expect(section(page, 'categories')).toBeInViewport();
  });

  test('sets the products section: top 10 by units as bars', async ({ page }) => {
    await open(page);

    await run(page, 'analytics.popular.show', {
      subject: 'products',
      limit: '10',
      measure: 'units',
      chart: 'bars',
    });

    await expect(section(page, 'products').getByTestId('popular-row')).toHaveCount(10);
    await expect(section(page, 'products').getByTestId('popular-headline')).toContainText(
      'of units sold',
    );
    await expect(section(page, 'products').getByTestId('rank-bars')).toBeVisible();
  });
});

test.describe('a link holds the whole state', () => {
  test('opens the table, the products as bars top 10 and the categories top 3 by orders', async ({
    page,
  }) => {
    await open(page, 'source=live&table=open&pTop=10&pChart=bars&cTop=3&cMeasure=orders');

    await expect(page.getByTestId('analytics-table')).toHaveJSProperty('open', true);
    await expect(select(page, 'popular-topn', '[data-test="popular-products"]')).toHaveValue('10');
    await expect(select(page, 'popular-chart', '[data-test="popular-products"]')).toHaveValue(
      'bars',
    );
    await expect(select(page, 'popular-topn', '[data-test="popular-categories"]')).toHaveValue('3');
    await expect(select(page, 'popular-measure', '[data-test="popular-categories"]')).toHaveValue(
      'orders',
    );
    await expect(select(page, 'popular-chart', '[data-test="popular-categories"]')).toHaveValue(
      'pie',
    );
  });
});

test.describe('the exports set the view first', () => {
  async function download(
    page: Page,
    id: string,
    args: Record<string, unknown>,
  ): Promise<Download> {
    const waiting = page.waitForEvent('download');
    await run(page, id, args);
    return waiting;
  }
  const bytesOf = async (d: Download) => readFileSync(await d.path());

  test("the owner's case: the PDF of the top 3 categories as bars, with the bars image and the legend", async ({
    page,
  }) => {
    await open(page);

    const pdf = await download(page, 'analytics.export.top_categories', {
      format: 'pdf',
      limit: '3',
      chart: 'bars',
    });
    const text = (await bytesOf(pdf)).toString('latin1');

    expect(pdf.suggestedFilename()).toMatch(/^analytics-top-categories-sales-.*\.pdf$/);
    expect(text.slice(0, 5)).toBe('%PDF-');
    expect(text).toContain('/Subtype /Image');
    for (const [at, title] of ['Jeans', 'T-Shirts', 'No category'].entries()) {
      expect(text, `legend line ${at + 1}`).toContain(`(${at + 1}. ${title})`);
    }
    expect(text).toContain('(Others)');
    await expect(select(page, 'popular-chart', '[data-test="popular-categories"]')).toHaveValue(
      'bars',
    );
    await expect(select(page, 'popular-topn', '[data-test="popular-categories"]')).toHaveValue('3');
    await shot(page, '40-owner-case-categories-top3-bars.png', 'popular-categories');
  });

  test('a products export names the measure and the chart; it does not change the chart type of the curve', async ({
    page,
  }) => {
    await open(page);

    const csv = await download(page, 'analytics.export.top_products', {
      format: 'csv',
      limit: '10',
      measure: 'orders',
      chart: 'bars',
    });

    expect(csv.suggestedFilename()).toMatch(/^analytics-top-products-orders-/);
    await expect(select(page, 'filter-chart')).toHaveValue('curved');
    await expect(select(page, 'popular-chart', '[data-test="popular-products"]')).toHaveValue(
      'bars',
    );
  });

  test('the chart export takes the whole page state', async ({ page }) => {
    await open(page);

    const csv = await download(page, 'analytics.export.chart', {
      format: 'csv',
      period: '7',
      curve: 'orders',
      scale: 'log',
      table: 'open',
    });

    expect(csv.suggestedFilename()).toMatch(/^analytics-orders-daily-/);
    await expect(select(page, 'filter-scale')).toHaveValue('log');
    await expect(page.getByTestId('analytics-table')).toHaveJSProperty('open', true);
  });
});

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test('axe finds nothing after the view actions (bars, table open, log scale)', async ({
      page,
    }) => {
      await open(page, `theme=${theme}&source=live`);
      await run(page, 'analytics.show', {
        granularity: 'weekly',
        scale: 'log',
        chart: 'bars',
        table: 'open',
        curve: 'customers',
      });
      await run(page, 'analytics.popular.show', {
        subject: 'products',
        limit: '10',
        chart: 'bars',
      });
      await run(page, 'analytics.popular.show', {
        subject: 'categories',
        limit: '3',
        chart: 'bars',
      });

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual(
        [],
      );
      await shot(page, `40-view-actions-${theme}.png`, 'analytics-popular');
    });
  });
}

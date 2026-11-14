import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Popular products and categories on the analytics page (Sprint 37), against the harness page and a stand-in shop:
 * both sections, the pie and the bars, Top N and the measure, the headline, links, German, and axe in the light and
 * the dark theme at 1280 and 360 px. With `E2E_SCREENSHOTS=<dir>` it also writes the screenshots of the sections.
 */
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '360', width: 360, height: 780 },
] as const;
const THEMES = ['light', 'dark'] as const;

const open = async (page: Page, params = ''): Promise<void> => {
  await page.goto(`/?${params}`);
  await expect(page.getByTestId('popular-products')).toBeVisible();
};
const section = (page: Page, subject: 'products' | 'categories') =>
  page.getByTestId(`popular-${subject}`);

async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map(
      (violation) => `${violation.id}: ${violation.nodes.map((n) => n.target).join(' | ')}`,
    ),
  ).toEqual([]);
}

test.describe('the colours of the pie', () => {
  for (const theme of THEMES) {
    test(`every slice and Others has its own colour, the legend shows the same (${theme})`, async ({
      page,
    }, info) => {
      await open(page, `theme=${theme}&source=live`);
      const products = section(page, 'products');
      await products.getByTestId('popular-topn').selectOption('15');

      const fills = await products
        .getByTestId('pie-slice')
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
      const swatches = await products
        .locator('.pie__swatch')
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));

      expect(fills).toHaveLength(16);
      expect(new Set(fills).size).toBe(16);
      expect(swatches).toEqual(fills);
      const directory = process.env.E2E_SCREENSHOTS;
      if (directory !== undefined) {
        mkdirSync(directory, { recursive: true });
        await products
          .getByTestId('pie')
          .screenshot({ path: resolve(directory, `39-pie-${theme}.png`) });
      }
      info.annotations.push({ type: 'colours', description: fills.join(' ') });
    });
  }
});

test.describe('the sections', () => {
  test('both sections show a headline, a pie with a legend and the sorted list of the top 5', async ({
    page,
  }) => {
    await open(page);

    await expect(page.getByRole('heading', { level: 2, name: 'Popular products' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Popular categories' })).toBeVisible();
    for (const subject of ['products', 'categories'] as const) {
      const box = section(page, subject);
      await expect(box.getByTestId('popular-headline')).toContainText(`Top 5 ${subject}:`);
      await expect(box.getByTestId('pie-svg')).toBeVisible();
      await expect(box.getByTestId('popular-row')).toHaveCount(5);
      // the whole is shown: five items and the others
      await expect(box.getByTestId('pie-legend-item')).toHaveCount(6);
    }
  });

  test('the switch changes the pie into bars with a label and a value on every bar, and back', async ({
    page,
  }) => {
    await open(page);
    const products = section(page, 'products');

    await products.getByTestId('popular-chart').selectOption('bars');

    await expect(products.getByTestId('pie')).toHaveCount(0);
    await expect(products.getByTestId('rank-bar')).toHaveCount(6);
    await expect(products.getByTestId('rank-bar').first()).toContainText('€');
    await expect(products.getByTestId('rank-bar').last()).toContainText('Others');
    await products.getByTestId('popular-chart').selectOption('pie');
    await expect(products.getByTestId('pie-svg')).toBeVisible();
  });

  test('Top N 5 to 10 and the measure change the list, the chart and the headline together', async ({
    page,
  }) => {
    await open(page, 'source=live');
    const products = section(page, 'products');
    await expect(products).toHaveAttribute('data-source', 'live');
    const before = await products.getByTestId('popular-headline').innerText();

    await products.getByTestId('popular-topn').selectOption('10');

    await expect(products.getByTestId('popular-row')).toHaveCount(10);
    await expect(products.getByTestId('pie-legend-item')).toHaveCount(11);
    await expect(products.getByTestId('popular-headline')).toContainText('Top 10 products');
    expect(await products.getByTestId('popular-headline').innerText()).not.toBe(before);

    await products.getByTestId('popular-measure').selectOption('units');
    await expect(products.getByTestId('popular-headline')).toContainText('of units sold');
    await expect(products.getByTestId('popular-row').first()).not.toContainText('€');
    await products.getByTestId('popular-measure').selectOption('orders');
    await expect(products.getByTestId('popular-headline')).toContainText('of orders');

    const calls = await page.evaluate(() => window.__shopCalls);
    expect(calls.at(-1)).toMatchObject({ limit: 10, measure: 'ORDERS' });
    // the categories keep their own choice
    await expect(section(page, 'categories').getByTestId('popular-row')).toHaveCount(5);
  });

  test('with the shop, a product and a category link to their pages and no-category is plain text', async ({
    page,
  }) => {
    await open(page, 'source=live');

    const productLink = section(page, 'products').getByTestId('popular-link').first();
    await expect(productLink).toHaveAttribute('href', '/catalogue/products/p01');
    await section(page, 'categories').getByTestId('popular-topn').selectOption('10');
    await expect(section(page, 'categories').getByTestId('popular-link').first()).toHaveAttribute(
      'href',
      /^\/catalogue\/categories\/c-/,
    );
    await expect(
      section(page, 'categories').getByRole('row', { name: /No category/ }),
    ).toBeVisible();
    await expect(
      section(page, 'categories').getByTestId('popular-link').filter({ hasText: 'No category' }),
    ).toHaveCount(0);
  });

  test('every control has a data-field id', async ({ page }) => {
    await open(page);

    const ids = await page
      .locator('[data-field]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-field')));
    expect(ids).toContain('analytics.products.topN');
    expect(ids).toContain('analytics.products.measure');
    expect(ids).toContain('analytics.products.chart');
    expect(ids).toContain('analytics.categories.topN');
    expect(await page.locator('select:not([data-field])').count()).toBe(0);
  });

  test('speaks German', async ({ page }) => {
    await open(page, 'lang=de');

    await expect(page.getByRole('heading', { level: 2, name: 'Beliebte Produkte' })).toBeVisible();
    await expect(section(page, 'categories').getByTestId('popular-headline')).toContainText(
      /Top 5 Kategorien: \d+,\d % des Umsatzes/,
    );
    await expect(section(page, 'products').getByTestId('pie-legend-item').last()).toContainText(
      'Übrige',
    );
  });
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${theme} theme at ${viewport.name} px`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const chart of ['pie', 'bars'] as const) {
        test(`axe finds nothing on the ${chart} state, the page does not scroll sideways`, async ({
          page,
        }, info) => {
          await open(page, `theme=${theme}&source=live`);
          for (const subject of ['products', 'categories'] as const) {
            await section(page, subject).getByTestId('popular-chart').selectOption(chart);
          }
          await section(page, 'products').getByTestId('popular-topn').selectOption('10');

          await expectNoViolations(page);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);

          const directory = process.env.E2E_SCREENSHOTS;
          if (directory === undefined) {
            return;
          }
          mkdirSync(directory, { recursive: true });
          await page.getByTestId('analytics-popular').screenshot({
            path: resolve(directory, `37-popular-${chart}-${theme}-${viewport.name}.png`),
          });
          info.annotations.push({
            type: 'screenshot',
            description: `${chart} ${theme} ${viewport.name}`,
          });
        });
      }
    });
  }
}

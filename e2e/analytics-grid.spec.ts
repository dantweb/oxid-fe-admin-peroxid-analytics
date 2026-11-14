import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * One layout grid (Sprint 40, story 8): the filter row and the stat row use the same columns, so filter n and tile n
 * have the same left and right edge at every width. The ranking sections and the chart card use the same outer edges
 * and the same gap. The content width changes when the admin's sidebar is open or folded; the harness takes 14rem or
 * 4rem from the page for that (`?sidebar=open|folded`). `E2E_SCREENSHOTS=<dir>` writes the screenshots.
 */
const WIDTHS = [1440, 1280, 1024, 768, 360] as const;
const SIDEBARS = ['open', 'folded'] as const;
const TOLERANCE = 1;

interface Box {
  left: number;
  right: number;
  top: number;
}

async function boxes(locator: Locator): Promise<Box[]> {
  return locator.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { left, right, top } = node.getBoundingClientRect();
      return { left, right, top };
    }),
  );
}

const open = async (page: Page, sidebar: string): Promise<void> => {
  await page.goto(`/?source=live&sidebar=${sidebar}`);
  await expect(page.getByTestId('popular-products')).toBeVisible();
};
const filters = (page: Page) => page.locator('[data-test="analytics-filters"] > label');
const tiles = (page: Page) => page.locator('[data-test="analytics-stats"] > *');

/** On a phone the admin has a drawer, not a sidebar next to the content: only the folded width applies there. */
const PHONE = 500;

for (const sidebar of SIDEBARS) {
  for (const width of WIDTHS.filter((w) => sidebar === 'folded' || w >= PHONE)) {
    test.describe(`sidebar ${sidebar} at ${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });

      test('filter n and tile n share the left and the right edge', async ({ page }) => {
        await open(page, sidebar);

        const [filterBoxes, tileBoxes] = [await boxes(filters(page)), await boxes(tiles(page))];

        expect(filterBoxes).toHaveLength(5);
        expect(tileBoxes).toHaveLength(5);
        filterBoxes.forEach((filter, at) => {
          expect(
            Math.abs(filter.left - tileBoxes[at]!.left),
            `left of ${at + 1}`,
          ).toBeLessThanOrEqual(TOLERANCE);
          expect(
            Math.abs(filter.right - tileBoxes[at]!.right),
            `right of ${at + 1}`,
          ).toBeLessThanOrEqual(TOLERANCE);
        });
      });

      test('the chart card and the ranking sections have the outer edges of the rows, and the rows have one gap', async ({
        page,
      }) => {
        await open(page, sidebar);

        const rows = await boxes(tiles(page));
        const left = Math.min(...rows.map((box) => box.left));
        const right = Math.max(...rows.map((box) => box.right));
        const outer = [
          ...(await boxes(page.getByTestId('analytics-chart-card'))),
          ...(await boxes(page.locator('[data-test="analytics-popular"]'))),
        ];
        for (const box of outer) {
          expect(Math.abs(box.left - left)).toBeLessThanOrEqual(TOLERANCE);
          expect(Math.abs(box.right - right)).toBeLessThanOrEqual(TOLERANCE);
        }
        const sections = await boxes(page.locator('[data-test^="popular-"][data-source]'));
        expect(sections).toHaveLength(2);
        expect(Math.min(...sections.map((box) => box.left))).toBeGreaterThanOrEqual(
          left - TOLERANCE,
        );
        expect(Math.max(...sections.map((box) => box.right))).toBeLessThanOrEqual(
          right + TOLERANCE,
        );
        const gap = await page.evaluate(() => {
          const grid = document.querySelector('[data-test="analytics-stats"]')!;
          return Number.parseFloat(getComputedStyle(grid).columnGap);
        });
        const side = sections[0]!.top === sections[1]!.top;
        const between = side ? sections[1]!.left - sections[0]!.right : sections[1]!.top - 0;
        if (side) {
          expect(Math.abs(between - gap)).toBeLessThanOrEqual(TOLERANCE);
        }
        const popularGap = await page.evaluate(() =>
          Number.parseFloat(
            getComputedStyle(document.querySelector('[data-test="analytics-popular"]')!).columnGap,
          ),
        );
        expect(popularGap).toBe(gap);
      });

      test('nothing runs past the edge: no sideways scroll, no tile or select wider than its box', async ({
        page,
      }) => {
        await open(page, sidebar);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        const clipped = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              '[data-test="analytics-stats"] > *, [data-test="analytics-filters"] > label, .popular__controls > label',
            ),
          ]
            .filter((node) => node.scrollWidth > node.clientWidth + 1)
            .map((node) => node.className),
        );
        expect(clipped).toEqual([]);
      });

      test('the controls of a ranking section sit on a grid of their own, inside the section', async ({
        page,
      }) => {
        await open(page, sidebar);

        for (const subject of ['products', 'categories']) {
          const section = (await boxes(page.getByTestId(`popular-${subject}`)))[0]!;
          const controls = await boxes(
            page.locator(`[data-test="popular-${subject}"] .popular__controls > label`),
          );
          expect(controls).toHaveLength(3);
          for (const control of controls) {
            expect(control.left).toBeGreaterThanOrEqual(section.left);
            expect(control.right).toBeLessThanOrEqual(section.right);
          }
          const lefts = new Set(controls.map((control) => Math.round(control.left)));
          const tops = new Set(controls.map((control) => Math.round(control.top)));
          // one row of three, or one column of three: never a ragged 2 + 1
          expect(
            (lefts.size === 3 && tops.size === 1) || (lefts.size === 1 && tops.size === 3),
          ).toBe(true);
        }
      });

      test('axe finds nothing', async ({ page }) => {
        await open(page, sidebar);

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
        ).toEqual([]);
        const directory = process.env.E2E_SCREENSHOTS;
        if (
          directory !== undefined &&
          ((sidebar === 'open' && width !== 1024 && width >= PHONE) ||
            (sidebar === 'folded' && width === 360))
        ) {
          mkdirSync(directory, { recursive: true });
          await page.screenshot({ path: resolve(directory, `40-grid-after-${width}.png`) });
        }
        if (directory !== undefined && sidebar === 'folded' && width === 1280) {
          await page.screenshot({ path: resolve(directory, '40-grid-after-folded-1280.png') });
        }
      });
    });
  }
}

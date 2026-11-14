# Analytics plugin: developer guide

This document is written in ASD-STE100 Simplified Technical English. It tells you how the plugin is built, how to extend
it and how to test it.

## 1 Structure

The package ships its sources (`.ts` and `.vue`). The project that uses it (for example peroxid-admin) compiles them.

| Path                                  | Task                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plugin.ts`                       | The plugin object `analyticsPlugin`: route `/analytics`, navigation entry, dashboard tile, messages, `uiFields`, `uiActions`, `setup()` |
| `src/types.ts`                        | The plugin types written out so that the package does not import the admin                                                              |
| `src/AnalyticsView.vue`               | The page: filters, tiles, chart, table, export menus, rankings, action handlers                                                         |
| `src/AnalyticsTile.vue`               | The tile for the dashboard slot                                                                                                         |
| `src/components/`                     | `FilterBar`, `StatTile`, `LineChart`, `PieChart`, `RankBars`, `RankingSection`, `ExportMenu`                                            |
| `src/useAnalytics.ts`                 | The filter state and the series (demo or live)                                                                                          |
| `src/usePopular.ts`                   | The state and the ranking of one section                                                                                                |
| `src/useTopShare.ts`                  | The share curve                                                                                                                         |
| `src/usePalette.ts`                   | The colours of the pie slices, read from the theme tokens                                                                               |
| `src/routeFilters.ts`                 | The filters and the route query, both ways                                                                                              |
| `src/liveSource.ts`                   | The GraphQL documents and the mapping of the answers                                                                                    |
| `src/ecw/`                            | The demo data (`demoData.ts`) and the demo rankings (`demoRanking.ts`)                                                                  |
| `src/series/`                         | Buckets, metrics, scales, curves, formats, ranking rules, pie geometry, palette                                                         |
| `src/export/`                         | The table model, CSV, XLSX, ZIP, PDF, the chart image, the download                                                                     |
| `src/uiFields.ts`, `src/uiActions.ts` | The descriptors for the UI map                                                                                                          |
| `src/messages.ts`                     | The texts in English and German (`analytics.*`)                                                                                         |
| `e2e/`                                | The mocked e2e: a harness page, a stand-in shop, two specs                                                                              |
| `tests/unit/`                         | The unit tests                                                                                                                          |

## 2 The sources of the numbers

| Source | Where it comes from                                                                    | When                                                       |
| ------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Demo   | `src/ecw/demoData.ts`, `src/ecw/demoRanking.ts`: seeded, deterministic, in the browser | Always available. It is the fallback.                      |
| Live   | The queries of the module `peroxid_analytics`, through the client of the admin         | The admin gave a client to `setup()`, and the shop answers |

- `useAnalytics()`, `usePopular()` and `useTopShare()` try the live source when the period, the granularity, N or the measure change.
- If the shop does not answer (no module, no right, an error), they use the demo data and set `source` to `demo`.
- The page sets `data-source` on the note and on each ranking section.
- The demo rankings add up to the demo orders of the period.

The queries: `adminAnalyticsSeries`, `adminAnalyticsTopProducts`, `adminAnalyticsTopCategories` and
`adminAnalyticsTopShareSeries`. The documents are in `src/liveSource.ts`. The contract of the series is in `live-data.md`.

## 3 Procedure: add a metric (a curve)

1. Add the id to `MetricId` in `src/series/metrics.ts`.
2. Add one entry to `METRICS`. Give it a `unit` (`count`, `currency`, `ratio` or `percent`) and `relative`.
3. Compute the values in `computeSeries()` (demo) and in `toSeries()` of `src/liveSource.ts` (live). Use the same rule for both.
4. Compute the total in `totals()`.
5. Add the text to `analytics.metrics.<id>` in `src/messages.ts`, in English and German.
6. Write the tests first in `tests/unit/series.spec.ts` and `tests/unit/liveSource.spec.ts`.
7. If the filter `curve` must accept the id from a link, no change is needed. `routeFilters.ts` reads `METRICS`.
8. Add the id to the enum values of the `curve` param in `src/uiActions.ts`. It reads `METRICS` already.

> **Note:** The curve "Share of top N products" is not a metric of the series. It has its own id `topShare`
> (`src/series/shareCurve.ts`) because it needs the ranking and the N of the products section.

## 4 The ranking rules

`src/series/ranking.ts` holds the rules. The shop module uses the same rules.

| Rule                                         | Function                                   |
| -------------------------------------------- | ------------------------------------------ |
| Sort by value, then title, then id           | `buildRanking()`                           |
| Cut at the top N. The rest is "Others".      | `buildRanking()`                           |
| Shares with one decimal that add up to 100   | `roundShares()` (largest remainder method) |
| One slice for each item and one for "Others" | `rankingSlices()`                          |
| N is 3, 5, 10, 15 or 20. The default is 5.   | `TOP_N_CHOICES`, `DEFAULT_TOP_N`           |

An item without an id is "No category" in a category ranking. In a product ranking, it is a product that you deleted after
the sale. It keeps its title and has no link.

## 5 The colours of the pie

`src/series/palette.ts` makes the colours. `src/usePalette.ts` reads the theme tokens `--oxfe-color-primary` and
`--oxfe-color-surface` and recomputes when the theme changes.

- The palette has 36 colours: 9 hues in 4 lightness tiers. The first hue is the hue of the brand colour.
- Each colour keeps a contrast of at least 3:1 with the surface (WCAG 1.4.11).
- Any two of the first 21 colours (20 items and "Others") are at least 0.06 apart (OKLab distance). Neighbours are at least 0.1 apart.
- "Others" is a neutral grey.
- After 36 slices the colours repeat in order. The legend names each slice, so a colour never carries a meaning alone.
- The pie, its legend and the PDF legend use the same colours.

## 6 The export model

`src/export/table.ts` defines `ExportTable`: `title`, `demo`, `meta`, `columns` and `rows`. A column has a `kind`
(`text`, `number`, `ratio`, `money`, `percent`). The page, the CSV, the XLSX and the PDF read this one model. "Show as table"
draws it too. So a file always holds what the page shows.

| File     | Module                                    | Notes                                                                                                                   |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CSV      | `csv.ts`                                  | RFC 4180, BOM, CRLF. `;` and decimal comma for German. A text that starts with `=`, `+`, `-` or `@` gets a leading `'`. |
| XLSX     | `xlsx.ts`, `zip.ts`                       | A stored ZIP with 5 parts. Number cells and inline strings. No dependency.                                              |
| PDF      | `pdf.ts`, `chartImage.ts`, `exportPdf.ts` | A4 landscape. The module `jspdf` loads on the first PDF.                                                                |
| Download | `download.ts`                             | A Blob, an object URL and a clicked `<a download>`. It needs a user action.                                             |

`exportTable.ts` makes a data file. `exportPdf.ts` makes a PDF with the chart image and an optional legend.

### 6.1 Procedure: add an export format

1. Write the tests in `tests/unit/export/`.
2. Add a module in `src/export/` that takes an `ExportTable` and returns text or bytes.
3. Add the format to `ExportFormat` and `exportTable()`.
4. Add an item to the menu in `AnalyticsView.vue` and `RankingSection.vue`, with texts in both languages.
5. Add the format to the `format` enum in `src/uiActions.ts`.

### 6.2 The lazy PDF

`src/export/pdf.ts` loads `jspdf` with `import('jspdf')`. There is no static import. A test checks this. The page does not
carry `jspdf` until the first PDF export.

A build of the e2e harness (`npx vite build --config e2e/vite.config.ts`) gave these sizes:

| Chunk                               | Size (gzip)           | Loaded                  |
| ----------------------------------- | --------------------- | ----------------------- |
| Entry (page, Vue, i18n, router)     | 221 kB (80 kB)        | At start                |
| `jspdf`                             | 391 kB (129 kB)       | At the first PDF export |
| `html2canvas`, `index.es`, `purify` | 202 kB, 160 kB, 30 kB | Lazy, loaded by `jspdf` |

## 7 UI fields and UI actions

The admin builds `ui-map.json` from the plugin object. The admin assistant reads it.

### 7.1 UI fields

Each field has `label` and `help` in English and German, `route` `/analytics` and `right` `ADMIN_ANALYTICS_VIEW`. The id is
the `data-field` of the control. The test `tests/unit/uiFields.spec.ts` keeps the descriptors and the page in step.

| Id                                                | Control                           |
| ------------------------------------------------- | --------------------------------- |
| `analytics.filter.range`                          | Period filter                     |
| `analytics.filter.granularity`                    | Granularity filter                |
| `analytics.filter.metric`                         | Curve filter                      |
| `analytics.filter.scale`                          | Scale filter                      |
| `analytics.filter.chartType`                      | Chart type filter                 |
| `analytics.products.topN`, `.measure`, `.chart`   | Controls of Popular products      |
| `analytics.categories.topN`, `.measure`, `.chart` | Controls of Popular categories    |
| `analytics.export.chart`                          | Export menu at the chart          |
| `analytics.export.table`                          | Export menu at the table          |
| `analytics.export.top_products`                   | Export menu of Popular products   |
| `analytics.export.top_categories`                 | Export menu of Popular categories |

### 7.2 UI actions

Each action has `route` `/analytics` and `right` `ADMIN_ANALYTICS_VIEW`. A view action has `auto: true`: the client of
the assistant runs it at once, without a click. An export has `auto: false`: it needs a click, because a download needs
a user action. All params are optional, except `format` of an export and `subject` of `analytics.popular.show`.

| Action                            | `auto` | `field`                           | Params                                                                                                                                                                                                                         |
| --------------------------------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `analytics.show`                  | true   | `analytics.table.toggle`          | `period` (`7`, `30`, `90`, `180`), `from` and `to` (date), `granularity` (`daily`, `weekly`), `curve` (a metric id or `topShare`), `scale` (`linear`, `log`), `chart` (`linear`, `curved`, `bars`), `table` (`open`, `closed`) |
| `analytics.popular.show`          | true   | `analytics.popular`               | `subject` (`products`, `categories`; required), `limit` (integer), `measure` (`sales`, `units`, `orders`), `chart` (`pie`, `bars`)                                                                                             |
| `analytics.export.chart`          | false  | `analytics.export.chart`          | `format` (`pdf`, `xlsx`, `csv`; required), then the params of `analytics.show`                                                                                                                                                 |
| `analytics.export.table`          | false  | `analytics.export.table`          | `format` (`xlsx`, `csv`; required), then the params of `analytics.show`                                                                                                                                                        |
| `analytics.export.top_products`   | false  | `analytics.export.top_products`   | `format` (`pdf`, `xlsx`, `csv`; required), `period`, `from`, `to`, `limit`, `measure`, `chart` (`pie`, `bars`)                                                                                                                 |
| `analytics.export.top_categories` | false  | `analytics.export.top_categories` | The same as `analytics.export.top_products`                                                                                                                                                                                    |

A date has the form `YYYY-MM-DD`. A custom period has at most 366 days. `limit` must be 3, 5, 10, 15 or 20. Another
value keeps the current Top N.

The param `chart` has two meanings. In `analytics.show` and in the exports of the chart and the table, it is the chart
type of the curve. In `analytics.popular.show` and in the ranking exports, it is the pie or the bars of a section.

### 7.2.1 The inventory of the controls

`PAGE_CONTROLS` in `src/uiActions.ts` lists each `data-field` of the page and the action param that sets it. The test
`tests/unit/uiActions.spec.ts` holds the table to the page. A new control without an entry fails the test.

| Control (`data-field`)                            | Action                                                           | Param                       |
| ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| `analytics.filter.range`                          | `analytics.show`                                                 | `period`, `from`, `to`      |
| `analytics.filter.granularity`                    | `analytics.show`                                                 | `granularity`               |
| `analytics.filter.metric`                         | `analytics.show`                                                 | `curve`                     |
| `analytics.filter.scale`                          | `analytics.show`                                                 | `scale`                     |
| `analytics.filter.chartType`                      | `analytics.show`                                                 | `chart`                     |
| `analytics.table.toggle`                          | `analytics.show`                                                 | `table`                     |
| `analytics.products.topN`, `.measure`, `.chart`   | `analytics.popular.show` (`subject` `products`)                  | `limit`, `measure`, `chart` |
| `analytics.categories.topN`, `.measure`, `.chart` | `analytics.popular.show` (`subject` `categories`)                | `limit`, `measure`, `chart` |
| `analytics.export.*` (four menus)                 | The export action of the same name                               | `format`                    |
| `analytics.popular`                               | Display only: the block that `analytics.popular.show` scrolls to | None                        |

### 7.3 How a handler works

1. The admin opens `/analytics` with the args as the route query.
2. The page reads the query, but not the args of an export or of `analytics.popular.show`. Those args hold `format` or
   `subject`. Their `chart` can mean the pie or the bars, so the handler owns that state.
3. The handler applies the args to the page and to the section (`applyPage`, `applyRanking`).
4. The handler waits until the data for the new state is ready (`settled()`).
5. A view action stops here. `analytics.popular.show` first scrolls to the section.
6. An export makes the file in that state.

The handler of `analytics.export.table` refuses `pdf`. The handler of `analytics.popular.show` refuses a `subject` that
is not `products` or `categories`. The admin then shows the error "failed".

The plugin does not import the admin. It gets the registry with `inject('oxadm:ui-actions')`. Without an admin that has
this key, the handlers are not registered. The page still works.

### 7.4 Procedure: add a control or a UI action

1. Add a field for the control in `src/uiFields.ts`. Use the id as `data-field` in the template.
2. Add the control to `PAGE_CONTROLS` in `src/uiActions.ts`, with the action param that sets it.
3. Add the param to the descriptor in `src/uiActions.ts`. Add the key to the route query in `src/routeState.ts` if the control is part of the page state.
4. Apply the param in the handler in `AnalyticsView.vue`.
5. Update `tests/unit/uiActions.spec.ts`, `tests/unit/routeState.spec.ts` and `tests/unit/uiFields.spec.ts`.
6. Add the case to `e2e/analytics-control.spec.ts`.

## 7A The layout grid

The page has one layout grid. The filter row and the stat row use the same columns. Filter n and tile n have the same left
and right edge at every width. The chart card and the two ranking sections have the same outer edges and the same gap.

### 7A.1 How it works

- `section.analytics` is a **container** (`container: analytics / inline-size`). The steps follow its width, not the width
  of the viewport. The width of the content changes when the sidebar of the admin is open or folded.
- The custom property `--analytics-gap` (1 rem) is the one gap of the page.
- The class `.analytics-row` makes a grid of `--analytics-columns` columns of `minmax(0, 1fr)`. The filter form
  (`FilterBar`) and the stat row both have this class.
- `.analytics-row > *` has `min-width: 0`. A control or a tile cannot make a column wider than its share.
- The value of a tile (`.stat__value`) has the font size `clamp(1.25rem, 2.2cqi, 1.875rem)`. It follows the container, so the
  value fits a column of the five-column step.

### 7A.2 The steps

| Width of the container     | Columns of the filter row and the stat row | Ranking sections              |
| -------------------------- | ------------------------------------------ | ----------------------------- |
| Less than 26 rem           | 1                                          | 1 column, one under the other |
| 26 rem to less than 40 rem | 2                                          | 1 column                      |
| 40 rem to less than 48 rem | 3                                          | 1 column                      |
| 48 rem to less than 64 rem | 3                                          | 2 columns, side by side       |
| 64 rem or more             | 5                                          | 2 columns, side by side       |

The controls of a ranking section (Show, Rank by, Chart) have a grid of their own. The section is a container too
(`container: popular / inline-size`). The controls are in 3 columns when the section is 28 rem wide or wider. They are in
one column when it is narrower. They are never in a ragged 2 + 1.

The foldable layout of the admin (class `fold-grid`) stays on the filter row and on the stat row. Both rows have the same
class, so both rows keep the same columns in that posture.

### 7A.3 Procedure: add a control to the filter row or a tile

1. Add the element as a direct child of the row. Do not wrap it.
2. Do not set a width on it. The grid sets the width.
3. Make the filter row and the stat row have the same number of items. Otherwise the items no longer pair by position.
4. Run `e2e/analytics-grid.spec.ts`.

### 7A.4 The test

`e2e/analytics-grid.spec.ts` measures the bounding boxes in the browser. The harness takes 14 rem (sidebar open) or 4 rem
(sidebar folded) from the page: `?sidebar=open` or `?sidebar=folded`. The widths are 1440, 1280, 1024, 768 and 360 px. At
360 px only the folded case applies, because a phone has a drawer and no sidebar.

The test checks for each case:

- filter n and tile n have equal left and right edges (tolerance 1 px);
- the chart card and the ranking sections have the outer edges of the rows, and the gap between the sections equals the gap of the rows;
- there is no sideways scroll, and no tile or control is wider than its box;
- the controls of a ranking section are in one row of three or in one column of three;
- axe finds no violation.

## 8 Tests

| Command                                           | What it does                                              |
| ------------------------------------------------- | --------------------------------------------------------- |
| `npm test`                                        | The unit tests (Vitest with happy-dom)                    |
| `npm run test:coverage`                           | The unit tests with coverage. The line threshold is 85 %. |
| `npm run lint`                                    | ESLint and Prettier                                       |
| `npm run type-check`                              | `vue-tsc`                                                 |
| `npm run knip`                                    | Unused files, exports and dependencies                    |
| `npx playwright test -c e2e/playwright.config.ts` | The mocked e2e with axe                                   |

The e2e needs Chromium: run `npx playwright install chromium` once. The Playwright config starts the harness page
(`e2e/harness`). The harness has the theme tokens of PEROXID light and dark and a stand-in shop. Set `E2E_BASE_URL` to use a
harness that already runs. Set `E2E_SCREENSHOTS=<folder>` to save the screenshots.

The e2e specs check:

- every place and every format: the file name, the content, the PDF header `%PDF-` and the image in the PDF;
- the files against the table on the page;
- the legend lines of the ranking PDFs;
- the distinct colours of the pie slices;
- the keyboard use of the menu;
- the UI action handlers, with the page state equal to the args (`e2e/analytics-control.spec.ts`);
- a link that holds the whole state;
- the owner's case: the PDF of the top 3 categories as bars, with the bars image and the legend;
- axe in the light and the dark theme at 1280 and 360 pixels.

CI (`.github/workflows/ci.yml`) has two jobs. The job `check` runs lint, type check, knip, `npm audit` and the unit tests with
coverage. The job `e2e` installs Chromium and runs the e2e.

## 9 Rules for a change

1. Write the test first.
2. Use only theme tokens (`var(--oxfe-…)`) for colours. The palette reads the tokens.
3. Do not use `any`, `eslint-disable` or `ts-ignore`.
4. Give each new control a `data-field` id and a descriptor in `uiFields`.
5. Do not use a colour alone to carry a meaning. Name the item in text.
6. Do not store anything in the browser (no `localStorage`).

# oxid-fe-admin-peroxid-analytics

An **Analytics** plugin for [`oxid-fe-admin`](https://github.com/dantweb/oxid-fe-admin), the headless OXID
admin SPA: curves of sales and customers with filters, a crosshair readout and a table view. It is a
**demo plugin without a backend**: the numbers are generated in the browser from a seeded model, no shop
data is read. The PEROXID project admin ([`peroxid-admin`](https://github.com/dantweb/peroxid-admin)) runs it.

| What                       | Where                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plugin object          | `src/plugin.ts` — `analyticsPlugin`: page `/analytics` (main navigation), a tile in the admin's `dashboard` slot, `analytics.*` texts (en, de)             |
| The page                   | `src/AnalyticsView.vue` — filter row · five stat tiles · the curve (`src/components/LineChart.vue`) · the same numbers as a table                          |
| Data model (atomizer port) | `src/atomizer/model.ts` — `Atom`, `Vector`, `Matrix` of [dantweb/atomizer](https://github.com/dantweb/atomizer), in TypeScript                             |
| Models (ecwatch port)      | `src/ecw/models.ts` — `BaseOrderModel`, `CustomerModel` as [dantweb/ecwatch-core](https://github.com/dantweb/ecwatch-core) declares them                   |
| Demo data                  | `src/ecw/demoData.ts` — the port of ecwatch-core's `demoda_data_generator.php` (anchored daily order counts, drifting basket value) plus customers; seeded |
| Series                     | `src/series/` — buckets (daily, ISO weeks), metrics, totals, linear/log scales, the smooth curve, formatting                                               |

## Filters

| Filter      | Values                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Period      | last 7 / 30 / 90 / 180 days                                                                                      |
| Granularity | daily · weekly (ISO weeks, named by their Monday)                                                                |
| Curve       | orders · sales · new customers · **orders per customer** · **sales per customer** · **average order** (relative) |
| Scale       | linear · logarithmic (buckets below 1 sit on the baseline)                                                       |
| Chart type  | linear (straight segments) · curved (the smooth curve, default) · bars (one per bucket)                          |

The filters scope everything below them: the tiles (with the change against the previous period of the
same length), the curve, the readout and the table.

## Live data from the shop (optional)

The plugin stays a demo without a backend. With the OXID module **`peroxid_analytics`**
([`source/extensions/oxid-fe-admin-peroxid-analytics`](https://github.com/dantweb/oxid-fe-admin-peroxid-analytics) of the SDK;
a `graphql-base` module on the admin API of `graphql-admin`) active in the shop, and an admin who holds the right
`ADMIN_ANALYTICS_VIEW`, the page shows the **shop's numbers**: one query, `adminAnalyticsSeries(from, to, granularity)`,
answers the buckets of the period already aggregated by the shop (orders, gross sales, new customers; no order, no
customer, no personal data leaves it). The plugin's `setup(context)` keeps the admin's GraphQL client; each change of period
or granularity asks the shop for the period and the one before it (`src/liveSource.ts`, `src/useAnalytics.ts`). The note
above the filters says which it is (`data-source="live"` or `"demo"`). Without the module (the field is unknown), without
the right (`permission_denied`) or without a session the plugin falls back to the demo data: the shop never has to be there.

## Use it in an admin project

```bash
npm install github:dantweb/oxid-fe-admin-peroxid-analytics#main
```

```ts
// src/main.ts of the project
import { startAdmin } from '@dantweb/oxid-fe-admin/src/bootstrap';
import { adminPlugins } from '@dantweb/oxid-fe-admin/src/plugins';
import { analyticsPlugin } from '@dantweb/oxid-fe-admin-peroxid-analytics';

void startAdmin({ plugins: [...adminPlugins, analyticsPlugin] });
```

Enable it per instance: `admin.plugins_enabled: [analytics]` in `oxid-admin-config.yaml`. The plugin has no
`module` (it needs no OXID module and no right), so it runs as soon as it is listed. The package ships its
sources (`.ts`, `.vue`); the project's Vite compiles them — list the package in `optimizeDeps.exclude`.

The plugin follows the admin's rules: no `v-html`, no browser storage, no raw colours in components (every
colour is a `var(--oxfe-…)` / `var(--oxadm-…)` token, so the project's themes style the charts), no external
hosts (the CSP allows `'self'` only), no `console`. Foldables: the admin alone reads the viewport segments and
publishes `data-segments` on `<html>` (`2x1` book, `1x2` laptop) and the `--oxadm-pane-*` / `--oxadm-hinge-*`
tokens; the plugin's grids and its filter row carry the admin's `fold-grid` class (they split at the hinge when the
content spans it), the chart card `fold-pane-b` (it moves into the content pane) and the chart keeps to the top pane on focus — no `env()` and no segment query in the plugin.

## Live data

How the plugin talks to the shop module and when it falls back: [`docs/live-data.md`](docs/live-data.md).

## Chart design

One series at a time, so there is no legend; the readout at the crosshair lists every metric at that bucket
with the plotted one first. The chart type draws the same series as straight segments, as the smooth curve
(Catmull-Rom through every point) or as bars (centred in equal bands, 60 % wide, the hovered one solid). 2 px line, a 10 % wash under it, an 8 px end marker with a 2 px surface ring,
the last value as the only direct label; hairline gridlines; axis ticks compact (12K), readouts in full.
Keyboard: focus the chart, arrow keys / Home / End walk the buckets, Escape hides the readout. The table
view holds every number without a pointer.

## Development

```bash
npm ci
npm run lint && npm run type-check && npm run knip && npm audit && npm run test:coverage
```

`tests/unit/` covers the atomizer port, the generator, the bucket and metric maths, the scales and curves,
the plugin object and the mounted views (vue-test-utils, happy-dom). CI runs the same gate.

## Licence

MIT. The ideas are ported from atomizer (CC BY-NC 4.0) and ecwatch-core; this package contains no code of
either, only TypeScript written after their models.

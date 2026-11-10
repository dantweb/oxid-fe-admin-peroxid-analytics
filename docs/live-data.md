# Live data: the contract with the `peroxid_analytics` module

The plugin has two sources for the same `Series` shape (`src/series/metrics.ts`):

| Source | When                                                                                                                              | Where the numbers come from                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `demo` | always available                                                                                                                  | `src/ecw/demoData.ts`: a seeded generator in the browser (ecwatch-core's demo generator ported), no request |
| `live` | the admin handed a client to `setup()`, the shop runs the OXID module `peroxid_analytics`, the admin holds `ADMIN_ANALYTICS_VIEW` | `adminAnalyticsSeries` of the module, aggregated by the shop                                                |

`useAnalytics()` (`src/useAnalytics.ts`) tries the live source on every change of period or granularity, for the period
and the period before it (the stat tiles compare the two), and falls back to the demo data when either call fails. The
metric and the scale are views on the series and cost no request. `source` (`'live' | 'demo'`) and `currency` are
exposed for the page: the note above the filters reads them (`data-source` attribute).

## The query (`src/liveSource.ts`, `SERIES_QUERY`)

```graphql
query AdminAnalyticsSeries(
  $from: DateTime!
  $to: DateTime!
  $granularity: AdminAnalyticsGranularity!
) {
  adminAnalyticsSeries(from: $from, to: $to, granularity: $granularity) {
    currency
    buckets {
      key
      orders
      sales
      customers
    }
  }
}
```

- `from` / `to` are sent as `YYYY-MM-DD` of the local calendar days of the chosen period (`lastDays`), `granularity` as
  `DAILY` or `WEEKLY`. The module counts whole days, both included, and answers every bucket of the period in order
  (empty ones as zeros), weekly buckets keyed by their ISO Monday — the same keys the demo data uses (`bucketKeys`).
- `toSeries()` maps the buckets to `Series` and computes `ordersPerCustomer`, `salesPerCustomer` and `averageOrder` in the browser,
  the same way as for the demo data (`ratio`, zero-safe). The module answers the ratios too, but the plugin uses one
  code path for both sources.
- The document selects **no personal field** (`tests/unit/liveSource.spec.ts` pins that), and the module has none to
  offer: its answer is counts and sums.

## Refusals

| The shop says                                                                  | The plugin does |
| ------------------------------------------------------------------------------ | --------------- |
| `Cannot query field "adminAnalyticsSeries"` (module not installed or inactive) | demo data       |
| `permission_denied` (the role lacks `ADMIN_ANALYTICS_VIEW`)                    | demo data       |
| `admin_session_required` (the client has no session)                           | demo data       |
| `analytics_range_invalid` (never sent: the presets are 7–180 days)             | demo data       |
| a network error                                                                | demo data       |

Every refusal is caught in `fetchLiveSeries()`; nothing is logged (the admin's rules forbid `console`), the note says
"Demo data". A later change of the period tries the shop again.

## Enabling it

1. In the shop: install and activate the module `peroxid_analytics` (its README: composer path repository,
   `oe:module:install`, `oe:module:activate peroxid_analytics`, `oe:graphql:cache-clear`, delete the container cache).
2. Give the admin's role the right `ADMIN_ANALYTICS_VIEW` (the superadmin holds every right of the catalogue).
3. Nothing in the plugin or the admin's instance config: the plugin notices the field and switches.

## Tests

`tests/unit/liveSource.spec.ts`: the mapping, the variables of the request, `null` on a refusal, `useAnalytics` with a
stub client (live, falls back, asks again on a period change, no request without a client), and `setup()` keeping the
client. The module's own tests (`source/extensions/oxid-fe-admin-peroxid-analytics/tests`) prove the server side: the
right, the refusals and the numbers of planted orders and customers.

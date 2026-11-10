# Changelog

## 0.5.0

- **Foldables** (oxid-fe-admin sprint FOLD-1): the stat tiles and the filter row carry the admin's `fold-grid` class, so
  with the content spanning a vertical hinge (book posture, rail collapsed) they split into two columns at the hinge; in
  the laptop posture a focus scrolls the chart into the top pane (`scroll-margin` from the admin's `--oxadm-hinge-start`).
  The plugin reads only `data-segments` and the tokens the admin publishes, never the segment queries.

## 0.4.0

- **Average order** (gross sales per order, zero-safe): a fifth stat tile after "Sales per customer" with the change
  against the previous period, a curve of its own, a row in the crosshair readout and a column in the table. Computed in
  the browser for the demo and the live data alike (`MetricId` `averageOrder`, relative, currency). The totals use the
  ratio of the sums, as the other relative metrics do.

## 0.3.0

- **Chart type** filter after the scale: `linear` (straight segments), `curved` (the smooth curve, the default as
  before) or `bars` (one bar per bucket, centred in equal bands so the first and the last stay inside the plot; the
  hovered bar is solid). The wash follows the chosen line, bars have none; the crosshair readout, the keyboard
  walk, the end label and the table are the same for all three. `AnalyticsFilters.chart`, `CHART_KINDS`.

## 0.2.0

- **Live data:** with the OXID module `peroxid_analytics` active and the right `ADMIN_ANALYTICS_VIEW`, the page shows the
  shop's aggregated numbers (`adminAnalyticsSeries`); otherwise the demo data, and the note says which. The plugin's
  `setup(context)` keeps the admin's client; `useAnalytics` takes `client`, `source` and `currency`.

## 0.1.0

First release: the `analytics` plugin for oxid-fe-admin.

- Page `/analytics` (main navigation) and a sales tile with a sparkline in the admin's `dashboard` slot.
- Curves of orders, sales, new customers, orders per customer and sales per customer; daily or weekly
  buckets; the last 7, 30, 90 or 180 days; linear or logarithmic axis; crosshair readout of every metric;
  the same numbers as a table; four stat tiles with the change against the previous period.
- Demo data generated in the browser (seeded), ported from ecwatch-core's demo generator over the
  ecwatch order and customer models and atomizer's Atom/Vector/Matrix. No backend, no shop data.

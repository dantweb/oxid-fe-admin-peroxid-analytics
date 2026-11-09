# Changelog

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

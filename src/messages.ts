/** `analytics.*` in both languages; tests/unit/plugin.spec.ts holds the two trees to the same keys. */
export const en = {
  nav: 'Analytics',
  title: 'Analytics',
  demoNote:
    'Demo data: generated in the browser from a seeded model (orders, customers). No shop data is read.',
  liveNote:
    'Shop data: orders, sales and new customers of this shop, aggregated by the shop (module peroxid_analytics).',
  filters: {
    legend: 'Filters',
    range: 'Period',
    granularity: 'Granularity',
    metric: 'Curve',
    scale: 'Scale',
    chartType: 'Chart type',
  },
  range: { d7: 'Last 7 days', d30: 'Last 30 days', d90: 'Last 90 days', d180: 'Last 180 days' },
  granularity: { daily: 'Daily', weekly: 'Weekly' },
  scale: { linear: 'Linear', log: 'Logarithmic' },
  chartType: { linear: 'Linear', curved: 'Curved', bars: 'Bars' },
  metrics: {
    orders: 'Orders',
    sales: 'Sales',
    customers: 'New customers',
    ordersPerCustomer: 'Orders per customer',
    salesPerCustomer: 'Sales per customer',
  },
  tiles: { delta: 'vs the previous period', noDelta: 'no previous period' },
  chart: {
    title: '{metric}, {granularity}',
    logNote: 'Logarithmic axis: buckets below 1 sit on the baseline.',
    ariaLabel: '{metric} over {count} buckets',
    hint: 'Move the pointer over the chart, or focus it and use the arrow keys, to read the values.',
  },
  table: { show: 'Show as table', bucket: 'Bucket' },
  tile: { title: 'Sales, last 30 days', open: 'Open analytics' },
} as const;

export const de = {
  nav: 'Analytics',
  title: 'Analytics',
  demoNote:
    'Demodaten: im Browser aus einem festen Modell erzeugt (Bestellungen, Kunden). Es werden keine Shopdaten gelesen.',
  liveNote:
    'Shopdaten: Bestellungen, Umsatz und Neukunden dieses Shops, vom Shop aggregiert (Modul peroxid_analytics).',
  filters: {
    legend: 'Filter',
    range: 'Zeitraum',
    granularity: 'Auflösung',
    metric: 'Kurve',
    scale: 'Skala',
    chartType: 'Diagrammtyp',
  },
  range: {
    d7: 'Letzte 7 Tage',
    d30: 'Letzte 30 Tage',
    d90: 'Letzte 90 Tage',
    d180: 'Letzte 180 Tage',
  },
  granularity: { daily: 'Täglich', weekly: 'Wöchentlich' },
  scale: { linear: 'Linear', log: 'Logarithmisch' },
  chartType: { linear: 'Linear', curved: 'Geschwungen', bars: 'Balken' },
  metrics: {
    orders: 'Bestellungen',
    sales: 'Umsatz',
    customers: 'Neue Kunden',
    ordersPerCustomer: 'Bestellungen pro Kunde',
    salesPerCustomer: 'Umsatz pro Kunde',
  },
  tiles: { delta: 'gegenüber dem Vorzeitraum', noDelta: 'kein Vorzeitraum' },
  chart: {
    title: '{metric}, {granularity}',
    logNote: 'Logarithmische Achse: Werte unter 1 liegen auf der Grundlinie.',
    ariaLabel: '{metric} über {count} Abschnitte',
    hint: 'Zeiger über das Diagramm bewegen oder es fokussieren und die Pfeiltasten nutzen, um Werte zu lesen.',
  },
  table: { show: 'Als Tabelle zeigen', bucket: 'Abschnitt' },
  tile: { title: 'Umsatz, letzte 30 Tage', open: 'Analytics öffnen' },
} as const;

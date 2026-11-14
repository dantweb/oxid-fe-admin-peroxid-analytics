import type { LocalizedText, UiFieldLike } from './types';

/**
 * The fields of the analytics page for the admin's UI map (`dist/ui-map.json`), so the admin assistant can answer
 * "where do I choose how many top products are shown?" and highlight the control. The ids are the `data-field` values
 * of the templates; tests/unit/uiFields.spec.ts keeps both in step.
 */
const ROUTE = '/analytics';
const RIGHT = 'ADMIN_ANALYTICS_VIEW';

const field = (id: string, label: LocalizedText, help: LocalizedText): UiFieldLike => ({
  id,
  label,
  help,
  route: ROUTE,
  right: RIGHT,
});

const POPULAR = {
  products: {
    en: 'popular products',
    de: 'beliebten Produkte',
  },
  categories: {
    en: 'popular categories',
    de: 'beliebten Kategorien',
  },
} as const;

function popularFields(subject: keyof typeof POPULAR): UiFieldLike[] {
  const what = POPULAR[subject];
  return [
    field(
      `analytics.${subject}.topN`,
      { en: `Number of ${what.en}`, de: `Anzahl der ${what.de}` },
      {
        en: `How many of the ${what.en} the list and the chart show: top 3, 5, 10, 15 or 20. The rest is shown as "Others".`,
        de: `Wie viele der ${what.de} die Liste und das Diagramm zeigen: Top 3, 5, 10, 15 oder 20. Der Rest steht unter „Übrige“.`,
      },
    ),
    field(
      `analytics.${subject}.measure`,
      { en: `Rank ${what.en} by`, de: `Rangfolge der ${what.de}` },
      {
        en: `What the ranking counts: sales, units sold or the number of orders. The shares follow the measure.`,
        de: `Was die Rangliste zählt: Umsatz, verkaufte Stück oder Anzahl der Bestellungen. Die Anteile folgen dem Maß.`,
      },
    ),
    field(
      `analytics.${subject}.chart`,
      { en: `Chart of ${what.en}`, de: `Diagramm der ${what.de}` },
      {
        en: `Draw the share of the ${what.en} as a pie or as bars.`,
        de: `Den Anteil der ${what.de} als Kreis oder als Balken zeichnen.`,
      },
    ),
  ];
}

const EXPORT_FIELDS: UiFieldLike[] = [
  field(
    'analytics.export.chart',
    { en: 'Export chart and data', de: 'Diagramm und Daten exportieren' },
    {
      en: 'The download button next to the chart title. Downloads the data table of the curve as Excel (XLSX) or CSV.',
      de: 'Der Download-Knopf neben dem Diagrammtitel. Lädt die Datentabelle der Kurve als Excel (XLSX) oder CSV herunter.',
    },
  ),
  field(
    'analytics.export.table',
    { en: 'Export table', de: 'Tabelle exportieren' },
    {
      en: 'The download button next to "Show as table". Downloads the table as Excel (XLSX) or CSV.',
      de: 'Der Download-Knopf neben „Als Tabelle zeigen“. Lädt die Tabelle als Excel (XLSX) oder CSV herunter.',
    },
  ),
  field(
    'analytics.export.top_products',
    { en: 'Export popular products', de: 'Beliebte Produkte exportieren' },
    {
      en: 'The download button of the Popular products section. Downloads the ranked list with "Others" as Excel (XLSX) or CSV.',
      de: 'Der Download-Knopf des Abschnitts Beliebte Produkte. Lädt die Rangliste mit „Übrige“ als Excel (XLSX) oder CSV herunter.',
    },
  ),
  field(
    'analytics.export.top_categories',
    { en: 'Export popular categories', de: 'Beliebte Kategorien exportieren' },
    {
      en: 'The download button of the Popular categories section. Downloads the ranked list with "Others" as Excel (XLSX) or CSV.',
      de: 'Der Download-Knopf des Abschnitts Beliebte Kategorien. Lädt die Rangliste mit „Übrige“ als Excel (XLSX) oder CSV herunter.',
    },
  ),
];

export const analyticsUiFields: UiFieldLike[] = [
  field(
    'analytics.filter.range',
    { en: 'Period', de: 'Zeitraum' },
    {
      en: 'The period of the whole page: last 7, 30, 90 or 180 days.',
      de: 'Der Zeitraum der ganzen Seite: die letzten 7, 30, 90 oder 180 Tage.',
    },
  ),
  field(
    'analytics.filter.granularity',
    { en: 'Granularity', de: 'Auflösung' },
    {
      en: 'Daily or weekly buckets for the curve and the table.',
      de: 'Tägliche oder wöchentliche Abschnitte für Kurve und Tabelle.',
    },
  ),
  field(
    'analytics.filter.metric',
    { en: 'Curve', de: 'Kurve' },
    {
      en: 'Which metric the curve shows: orders, sales, new customers or a ratio per customer or order.',
      de: 'Welche Kennzahl die Kurve zeigt: Bestellungen, Umsatz, Neukunden oder ein Verhältnis je Kunde oder Bestellung.',
    },
  ),
  field(
    'analytics.filter.scale',
    { en: 'Scale', de: 'Skala' },
    {
      en: 'A linear or a logarithmic value axis for the curve.',
      de: 'Eine lineare oder logarithmische Wertachse für die Kurve.',
    },
  ),
  field(
    'analytics.filter.chartType',
    { en: 'Chart type', de: 'Diagrammtyp' },
    {
      en: 'Draw the curve with straight segments, as a smooth curve or as bars.',
      de: 'Die Kurve mit geraden Segmenten, geschwungen oder als Balken zeichnen.',
    },
  ),
  ...popularFields('products'),
  ...popularFields('categories'),
  ...EXPORT_FIELDS,
];

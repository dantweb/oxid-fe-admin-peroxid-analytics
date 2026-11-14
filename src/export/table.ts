import { formatValue } from '../series/format';
import type { Ranking } from '../series/ranking';

/**
 * The one table model of the page: "Show as table", the CSV and the XLSX all read it, so what a file holds is what the
 * admin sees (the same columns, the same rows). Cells are raw values (numbers stay numbers); `formatCell` is how the
 * page writes one down.
 */
export type ColumnKind = 'text' | 'number' | 'ratio' | 'money' | 'percent';

export interface ExportColumn {
  label: string;
  kind: ColumnKind;
  /** ISO code, for `money` */
  currency?: string;
}

export type Cell = string | number;

export interface ExportTable {
  title: string;
  /** the numbers are generated, not the shop's: the files say so in their first row */
  demo: boolean;
  /** lines that describe the table (period, curve, scale, source) */
  meta: string[];
  columns: ExportColumn[];
  rows: Cell[][];
}

export interface SeriesTableInput {
  title: string;
  demo: boolean;
  meta: string[];
  bucketLabel: string;
  currency: string;
  /** `YYYY-MM-DD` of the day or of the Monday of the ISO week */
  keys: readonly string[];
  curves: readonly {
    label: string;
    kind: Exclude<ColumnKind, 'text'>;
    values: readonly number[];
  }[];
}

export function seriesTable(input: SeriesTableInput): ExportTable {
  const columns: ExportColumn[] = [
    { label: input.bucketLabel, kind: 'text' },
    ...input.curves.map((curve): ExportColumn => {
      return curve.kind === 'money'
        ? { label: curve.label, kind: 'money', currency: input.currency }
        : { label: curve.label, kind: curve.kind };
    }),
  ];
  const rows = input.keys.map((key, at): Cell[] => [
    key,
    ...input.curves.map((curve) => curve.values[at] ?? 0),
  ]);
  return { title: input.title, demo: input.demo, meta: input.meta, columns, rows };
}

export interface RankingTableInput {
  title: string;
  demo: boolean;
  meta: string[];
  ranking: Ranking;
  /** products have an article number, categories do not */
  withNumber: boolean;
  rank: string;
  name: string;
  number: string;
  value: string;
  share: string;
  others: string;
  noCategory: string;
}

/** The ranked list as the page lists it: the items, then "Others" so that the shares add up to 100. */
export function rankingTable(input: RankingTableInput): ExportTable {
  const { ranking } = input;
  const valueColumn: ExportColumn =
    ranking.measure === 'sales'
      ? { label: input.value, kind: 'money', currency: ranking.currency }
      : { label: input.value, kind: 'number' };
  const columns: ExportColumn[] = [
    { label: input.rank, kind: 'number' },
    { label: input.name, kind: 'text' },
    ...(input.withNumber ? [{ label: input.number, kind: 'text' } as const] : []),
    valueColumn,
    { label: input.share, kind: 'percent' },
  ];
  const line = (rank: Cell, name: string, number: string, value: number, share: number): Cell[] => [
    rank,
    name,
    ...(input.withNumber ? [number] : []),
    value,
    share,
  ];
  const rows = ranking.items.map((item) =>
    line(
      item.rank,
      item.id === null ? input.noCategory : item.title,
      item.number ?? '',
      item.value,
      item.share,
    ),
  );
  if (ranking.others > 0) {
    rows.push(line('', input.others, '', ranking.others, ranking.othersShare));
  }
  return { title: input.title, demo: input.demo, meta: input.meta, columns, rows };
}

/** One cell as the page writes it: money with its currency, counts as whole numbers, a share with one decimal. */
export function formatCell(value: Cell, column: ExportColumn, locale: string): string {
  if (typeof value === 'string') {
    return value;
  }
  switch (column.kind) {
    case 'money':
      return formatValue(value, 'currency', locale, false, column.currency);
    case 'percent':
      return formatValue(value, 'percent', locale);
    case 'ratio':
      return formatValue(value, 'ratio', locale);
    default:
      return formatValue(value, 'count', locale);
  }
}

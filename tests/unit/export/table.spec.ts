import { describe, expect, it } from 'vitest';
import { formatCell, rankingTable, seriesTable } from '../../../src/export/table';
import { buildRanking } from '../../../src/series/ranking';

const series = {
  title: 'Sales, daily',
  demo: true,
  meta: ['Period: 2026-11-02 – 2026-11-04'],
  bucketLabel: 'Bucket',
  currency: 'CHF',
  keys: ['2026-11-02', '2026-11-03', '2026-11-04'],
  curves: [
    { label: 'Orders', kind: 'number' as const, values: [2, 0, 1] },
    { label: 'Sales', kind: 'money' as const, values: [40, 0, 5.5] },
    { label: 'Share of top 5 products', kind: 'percent' as const, values: [50, 0, 33.3] },
  ],
};

describe('seriesTable', () => {
  it('has the bucket column and one column per curve, in the order of "Show as table"', () => {
    const table = seriesTable(series);

    expect(table.columns).toEqual([
      { label: 'Bucket', kind: 'text' },
      { label: 'Orders', kind: 'number' },
      { label: 'Sales', kind: 'money', currency: 'CHF' },
      { label: 'Share of top 5 products', kind: 'percent' },
    ]);
    expect(table.title).toBe('Sales, daily');
    expect(table.demo).toBe(true);
    expect(table.meta).toEqual(['Period: 2026-11-02 – 2026-11-04']);
  });

  it('one row per bucket of the calendar, an empty bucket is 0 and the key is the ISO day', () => {
    const table = seriesTable(series);

    expect(table.rows).toEqual(
      [
        ['2026-11-02', 2, 40, 50],
        ['2026-11-03', 0, 0, 0],
        ['2026-11-04', 1, 5.5, 33.3],
      ].map(([key, orders, sales, share]) => [key, orders, sales, share]),
    );
  });

  it('a curve shorter than the calendar is padded with 0, never left missing', () => {
    const table = seriesTable({
      ...series,
      curves: [{ label: 'Orders', kind: 'number', values: [7] }],
    });

    expect(table.rows.map((row) => row[1])).toEqual([7, 0, 0]);
  });
});

describe('rankingTable', () => {
  const ranking = buildRanking(
    [
      { id: 'a', number: 'A-1', title: 'Alpha', value: 30 },
      { id: 'b', number: 'B-2', title: 'Beta', value: 20 },
      { id: 'c', number: 'C-3', title: 'Gamma', value: 10 },
    ],
    2,
    'sales',
    'CHF',
  );
  const labels = {
    title: 'Top 2 products: 83.3 % of sales',
    demo: false,
    meta: [],
    rank: 'Rank',
    name: 'Product',
    number: 'Article number',
    value: 'Sales',
    share: 'Share',
    others: 'Others',
    noCategory: 'No category',
  };

  it('lists the items and the others line with value and share; sales are money in the currency', () => {
    const table = rankingTable({ ...labels, ranking, withNumber: true });

    expect(table.columns).toEqual([
      { label: 'Rank', kind: 'number' },
      { label: 'Product', kind: 'text' },
      { label: 'Article number', kind: 'text' },
      { label: 'Sales', kind: 'money', currency: 'CHF' },
      { label: 'Share', kind: 'percent' },
    ]);
    expect(table.rows).toEqual([
      [1, 'Alpha', 'A-1', 30, 50],
      [2, 'Beta', 'B-2', 20, 33.3],
      ['', 'Others', '', 10, 16.7],
    ]);
  });

  it('units and orders are plain numbers; categories have no article number and name the no-category line', () => {
    const categories = buildRanking(
      [
        { id: null, number: null, title: 'No category', value: 6 },
        { id: 'x', number: null, title: 'Shirts', value: 4 },
      ],
      5,
      'units',
      'CHF',
    );

    const table = rankingTable({ ...labels, ranking: categories, withNumber: false });

    expect(table.columns.map((column) => column.kind)).toEqual([
      'number',
      'text',
      'number',
      'percent',
    ]);
    expect(table.rows).toEqual([
      [1, 'No category', 6, 60],
      [2, 'Shirts', 4, 40],
    ]);
  });

  it('no others line when nothing is left over', () => {
    const all = buildRanking(
      [{ id: 'a', number: null, title: 'Alpha', value: 5 }],
      5,
      'orders',
      'EUR',
    );

    expect(rankingTable({ ...labels, ranking: all, withNumber: false }).rows).toEqual([
      [1, 'Alpha', 5, 100],
    ]);
  });
});

describe('formatCell', () => {
  it('formats a cell as the page shows it', () => {
    expect(formatCell(1234.5, { label: 'x', kind: 'money', currency: 'CHF' }, 'en')).toMatch(
      /1,234\.50/,
    );
    expect(formatCell(1234, { label: 'x', kind: 'number' }, 'en')).toBe('1,234');
    expect(formatCell(42.34, { label: 'x', kind: 'percent' }, 'de')).toBe('42,3 %');
    expect(formatCell(1.6667, { label: 'x', kind: 'ratio' }, 'en')).toBe('1.67');
    expect(formatCell('Alpha', { label: 'x', kind: 'text' }, 'en')).toBe('Alpha');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildRanking,
  DEFAULT_TOP_N,
  rankingSlices,
  roundShares,
  TOP_N_CHOICES,
  type RankedEntry,
} from '../../src/series/ranking';

const entry = (id: string | null, title: string, value: number): RankedEntry => ({
  id,
  number: id === null ? null : id.toUpperCase(),
  title,
  value,
});

describe('roundShares', () => {
  it('keeps exact shares and adds up to 100 when rounding would not', () => {
    expect(roundShares([50, 30, 20], 100)).toEqual([50, 30, 20]);
    expect(roundShares([1, 1, 1], 3)).toEqual([33.4, 33.3, 33.3]);
    expect(roundShares([2, 1], 3)).toEqual([66.7, 33.3]);
  });

  it('is all zeros without a total or without values', () => {
    expect(roundShares([0, 0], 0)).toEqual([0, 0]);
    expect(roundShares([], 10)).toEqual([]);
  });

  it('adds up to exactly 100 for awkward values', () => {
    const values = [30, 30, 5, 1, 0.01];
    const shares = roundShares(values, 66.01);
    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 10)).toBe(1000);
  });
});

describe('buildRanking', () => {
  const entries = [
    entry('c', 'Gamma', 5),
    entry('a', 'Alpha', 30),
    entry('d', 'Gone', 1),
    entry('b', 'Beta', 30),
  ];

  it('cuts the list at the limit and puts the rest into others', () => {
    const ranking = buildRanking(entries, 2, 'sales', 'CHF');

    expect(ranking.items.map((item) => [item.rank, item.id, item.value])).toEqual([
      [1, 'a', 30],
      [2, 'b', 30],
    ]);
    expect(ranking.currency).toBe('CHF');
    expect([ranking.total, ranking.topTotal, ranking.others]).toEqual([66, 60, 6]);
    expect([ranking.topShare, ranking.othersShare]).toEqual([90.9, 9.1]);
  });

  it('shows everything and no others when the limit covers all entries', () => {
    const ranking = buildRanking(entries, 10, 'units', 'EUR');

    expect(ranking.items).toHaveLength(4);
    expect(ranking.others).toBe(0);
    expect(ranking.othersShare).toBe(0);
    expect(ranking.topShare).toBe(100);
    expect(ranking.items.map((item) => item.share)).toEqual([45.5, 45.4, 7.6, 1.5]);
  });

  it('sorts equal values by title and then id, whatever the input order', () => {
    const reversed = buildRanking([...entries].reverse(), 4, 'sales', 'EUR');
    const forward = buildRanking(entries, 4, 'sales', 'EUR');

    expect(reversed.items.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(forward.items).toEqual(reversed.items);
    const same = buildRanking(
      [entry('2', 'Same', 5), entry('1', 'Same', 5), entry('3', 'Same', 5)],
      3,
      'orders',
      'EUR',
    );
    expect(same.items.map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('the shares of the items and others add up to 100', () => {
    const ranking = buildRanking(entries, 3, 'sales', 'EUR');
    const sum = ranking.items.reduce((total, item) => total + item.share, ranking.othersShare);

    expect(Math.round(sum * 10)).toBe(1000);
    expect(Math.round((ranking.topShare + ranking.othersShare) * 10)).toBe(1000);
  });

  it('an empty period is an empty ranking with zero shares', () => {
    const ranking = buildRanking([], 5, 'sales', 'EUR');

    expect(ranking.items).toEqual([]);
    expect([ranking.total, ranking.topTotal, ranking.topShare, ranking.othersShare]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('keeps an entry without an id (no category) in the list', () => {
    const ranking = buildRanking(
      [entry(null, 'No category', 6), entry('x', 'X', 2)],
      5,
      'sales',
      'EUR',
    );

    expect(ranking.items[0]).toMatchObject({ id: null, number: null, value: 6, share: 75 });
  });
});

describe('rankingSlices', () => {
  it('is one slice per item plus others when something is left over', () => {
    const ranking = buildRanking(
      [entry('a', 'Alpha', 30), entry('b', 'Beta', 20), entry('c', 'Gamma', 10)],
      2,
      'sales',
      'EUR',
    );

    expect(rankingSlices(ranking).map((slice) => [slice.key, slice.value, slice.share])).toEqual([
      ['a', 30, 50],
      ['b', 20, 33.3],
      ['others', 10, 16.7],
    ]);
    expect(rankingSlices(ranking).map((slice) => slice.kind)).toEqual(['item', 'item', 'others']);
  });

  it('has no others slice when nothing is left over', () => {
    const ranking = buildRanking([entry('a', 'Alpha', 30)], 5, 'sales', 'EUR');

    expect(rankingSlices(ranking).map((slice) => slice.key)).toEqual(['a']);
  });

  it('keys an item without an id by its rank, so that two of them (deleted products) stay unique', () => {
    const ranking = buildRanking(
      [entry(null, 'No category', 6), entry('x', 'X', 2)],
      5,
      'sales',
      'EUR',
    );

    expect(rankingSlices(ranking).map((slice) => slice.key)).toEqual(['none-1', 'x']);
  });
});

describe('the choices', () => {
  it('offers 3, 5, 10, 15 and 20 and starts at 5', () => {
    expect(TOP_N_CHOICES).toEqual([3, 5, 10, 15, 20]);
    expect(DEFAULT_TOP_N).toBe(5);
  });
});

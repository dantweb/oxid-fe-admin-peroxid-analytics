import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../../src/useAnalytics';
import { filtersFromQuery, queryFromFilters } from '../../src/routeFilters';

describe('filtersFromQuery', () => {
  it('reads every filter of the page from the query', () => {
    expect(
      filtersFromQuery({
        period: '90',
        granularity: 'weekly',
        curve: 'customers',
        scale: 'log',
        chart: 'bars',
      }),
    ).toEqual({
      rangeDays: 90,
      from: '',
      to: '',
      granularity: 'weekly',
      metric: 'customers',
      scale: 'log',
      chart: 'bars',
    });
  });

  it('reads a custom period from from and to, and it wins over period', () => {
    expect(filtersFromQuery({ period: '7', from: '2026-10-01', to: '2026-10-31' })).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('knows the share curve', () => {
    expect(filtersFromQuery({ curve: 'topShare' })).toEqual({ metric: 'topShare' });
  });

  it('ignores a value that is not allowed, so the filter keeps its default', () => {
    expect(
      filtersFromQuery({
        period: '45',
        granularity: 'hourly',
        curve: 'profit',
        scale: 'sqrt',
        chart: 'pie',
      }),
    ).toEqual({});
  });

  it.each([
    ['only from', { from: '2026-10-01' }],
    ['only to', { to: '2026-10-31' }],
    ['a date that is not YYYY-MM-DD', { from: '1.10.2026', to: '2026-10-31' }],
    ['a date that does not exist', { from: '2026-02-30', to: '2026-03-10' }],
    ['to before from', { from: '2026-10-31', to: '2026-10-01' }],
    ['more than 366 days', { from: '2025-01-01', to: '2026-10-31' }],
  ])('ignores a custom period with %s', (_name, query) => {
    expect(filtersFromQuery(query)).toEqual({});
  });

  it('takes the first value of a repeated key and ignores null and unknown keys', () => {
    expect(filtersFromQuery({ scale: ['log', 'linear'], chart: null, other: 'x' })).toEqual({
      scale: 'log',
    });
  });
});

describe('queryFromFilters', () => {
  it('writes every filter, with the period as days', () => {
    expect(queryFromFilters(DEFAULT_FILTERS)).toEqual({
      period: '30',
      granularity: 'daily',
      curve: 'sales',
      scale: 'linear',
      chart: 'curved',
    });
  });

  it('writes a custom period as from and to instead of period', () => {
    expect(queryFromFilters({ ...DEFAULT_FILTERS, from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      granularity: 'daily',
      curve: 'sales',
      scale: 'linear',
      chart: 'curved',
    });
  });

  it('round-trips: what the page writes, it reads back', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      rangeDays: 7 as const,
      granularity: 'weekly' as const,
      metric: 'topShare' as const,
      scale: 'log' as const,
      chart: 'bars' as const,
    };

    expect({ ...DEFAULT_FILTERS, ...filtersFromQuery(queryFromFilters(filters)) }).toEqual(filters);
  });
});

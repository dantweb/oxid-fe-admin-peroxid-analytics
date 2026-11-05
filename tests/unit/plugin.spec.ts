import { describe, expect, it } from 'vitest';
import { analyticsPlugin } from '../../src';
import { de, en } from '../../src/messages';

describe('analyticsPlugin', () => {
  it('is named analytics, has a page in the main navigation and fills the dashboard slot', () => {
    expect(analyticsPlugin.name).toBe('analytics');
    expect(analyticsPlugin.routes.map((route) => route.path)).toEqual(['/analytics']);
    expect(analyticsPlugin.navItems).toEqual([
      { labelKey: 'analytics.nav', to: '/analytics', section: 'nav.sections.main', order: 20 },
    ]);
    expect(Object.keys(analyticsPlugin.overrides)).toEqual(['dashboard']);
  });

  it('needs no OXID module and no right: the data is generated in the browser', () => {
    expect(analyticsPlugin).not.toHaveProperty('module');
    expect(analyticsPlugin.routes[0]).not.toHaveProperty('meta');
  });

  it('loads its views lazily', async () => {
    const view = await analyticsPlugin.routes[0]!.component!();
    const tile = await analyticsPlugin.overrides.dashboard();
    expect(view).toHaveProperty('default');
    expect(tile).toHaveProperty('default');
  });

  it('has the same texts in English and German', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
        typeof inner === 'object' ? keys(inner, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    expect(keys(de)).toEqual(keys(en));
    expect(analyticsPlugin.messages).toEqual({ en, de });
  });
});

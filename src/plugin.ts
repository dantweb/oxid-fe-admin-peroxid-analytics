import { de, en } from './messages';
import type { AdminPluginLike } from './types';

/**
 * The plugin object oxid-fe-admin registers: a page (`/analytics`, main navigation) and a tile in the
 * `dashboard` slot. It has no `module`: it needs no OXID module and no right — the data is generated in
 * the browser — so it runs as soon as an instance lists `analytics` in `admin.plugins_enabled`.
 */
export const analyticsPlugin = {
  name: 'analytics',
  version: '0.1.0',
  routes: [
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('./AnalyticsView.vue'),
    },
  ],
  navItems: [
    { labelKey: 'analytics.nav', to: '/analytics', section: 'nav.sections.main', order: 20 },
  ],
  overrides: { dashboard: () => import('./AnalyticsTile.vue') },
  messages: { en, de },
} satisfies AdminPluginLike;

import { rememberClient, type Executor } from './liveSource';
import { de, en } from './messages';
import type { AdminPluginLike } from './types';

/**
 * The plugin object oxid-fe-admin registers: a page (`/analytics`, main navigation) and a tile in the
 * `dashboard` slot. It has no `module`: it runs as soon as an instance lists `analytics` in
 * `admin.plugins_enabled`, on demo data generated in the browser. When the shop runs the OXID module
 * `peroxid_analytics` and the admin holds `ADMIN_ANALYTICS_VIEW`, the page shows the shop's numbers instead
 * (`src/liveSource.ts`): `setup()` keeps the admin's GraphQL client for that.
 */
export const analyticsPlugin = {
  name: 'analytics',
  version: '0.4.0',
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
  setup(context: { client: Executor }): void {
    rememberClient(context.client);
  },
} satisfies AdminPluginLike;

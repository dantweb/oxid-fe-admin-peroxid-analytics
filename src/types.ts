import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import type { Executor } from './liveSource';

/**
 * The shape oxid-fe-admin's `AdminPlugin` (`src/shell/types.ts`, core's `IPlugin<AdminSlot>`) expects,
 * written out structurally so this public package needs no import from the private admin. The admin's
 * `vue-tsc` proves the assignment when the plugin is listed in its `startAdmin({ plugins })`.
 */
export interface AdminNavItem {
  labelKey: string;
  to: string;
  section?: string;
  order?: number;
  requiredRight?: string;
}

export type ViewLoader = () => Promise<{ default: Component }>;

export interface AdminPluginLike {
  name: string;
  version: string;
  routes?: RouteRecordRaw[];
  navItems?: AdminNavItem[];
  /** slot name → lazily loaded filler; the admin renders `dashboard` on its start page */
  overrides?: Record<string, ViewLoader>;
  /** locale → message subtree, merged by the admin under the plugin's name */
  messages?: Record<string, Record<string, unknown>>;
  requires?: string[];
  /** the admin calls it once at boot with its GraphQL client (core's `PluginContext`) */
  setup?(context: { client: Executor }): void | Promise<void>;
}

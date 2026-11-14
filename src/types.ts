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

/** A text in both languages the admin ships. */
export interface LocalizedText {
  en: string;
  de: string;
}

/** One field of a screen for the admin's UI map (`UiFieldDescriptor` of oxid-fe-admin, `src/shell/types.ts`). */
export interface UiFieldLike {
  /** `<area>.<field>`, the `data-field` the template renders */
  id: string;
  label: LocalizedText;
  help: LocalizedText;
  route: string;
  tab?: string;
  right?: string;
}

/** One argument of a UI action (`UiActionParam` of oxid-fe-admin). A `date` is `YYYY-MM-DD`. */
export interface UiActionParamLike {
  name: string;
  type: 'enum' | 'date' | 'string' | 'int';
  values?: string[];
  required: boolean;
}

/** One page action for the admin's UI map (`UiActionDescriptor` of oxid-fe-admin, `src/shell/types.ts`). */
export interface UiActionLike {
  id: string;
  label: LocalizedText;
  help: LocalizedText;
  route: string;
  right: string;
  /** a declared UI field: the control that is highlighted while the action runs */
  field: string;
  params: UiActionParamLike[];
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
  /** the fields the plugin's screens expose to the UI map, so the admin assistant can point at them */
  uiFields?: UiFieldLike[];
  /** the page actions the admin assistant may run (`registerUiAction` of the page is the handler) */
  uiActions?: UiActionLike[];
  requires?: string[];
  /** the admin calls it once at boot with its GraphQL client (core's `PluginContext`) */
  setup?(context: { client: Executor }): void | Promise<void>;
}

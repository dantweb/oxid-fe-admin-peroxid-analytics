import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import type { Component } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import { de, en } from '../../src/messages';

/** Mounts a component the way the admin would: vue-i18n with `analytics.*`, a router with the plugin route. */
export function mountInAdmin<T extends Component>(
  component: T,
  options: ComponentMountingOptions<T> = {},
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en: { analytics: en }, de: { analytics: de } },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/analytics', component: { template: '<div />' } },
    ],
  });
  return mount(component, { ...options, global: { plugins: [i18n, router], ...options.global } });
}

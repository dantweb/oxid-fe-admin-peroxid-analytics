import { createApp, h } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { rememberClient } from '../../src/liveSource';
import { de, en } from '../../src/messages';
import { mockShop } from './shop';

/**
 * Mounts the analytics page the way the admin does (vue-i18n with `analytics.*`, a router) on a page with the theme
 * tokens of PEROXID. Query: `?theme=dark`, `?lang=de`, `?source=live` (the page asks a stand-in shop).
 */
declare global {
  interface Window {
    __shopCalls: Record<string, unknown>[];
  }
}

const query = new URLSearchParams(window.location.search);
document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const locale = query.get('lang') === 'de' ? 'de' : 'en';
document.documentElement.lang = locale;
window.__shopCalls = [];
if (query.get('source') === 'live') {
  rememberClient(mockShop(window.__shopCalls));
}

const stub = { render: () => null };
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/analytics', component: stub },
    { path: '/catalogue/products/:id', component: stub },
    { path: '/catalogue/categories/:id', component: stub },
  ],
});
const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { en: { analytics: en }, de: { analytics: de } },
});

createApp({ render: () => h('main', [h(AnalyticsView)]) })
  .use(i18n)
  .use(router)
  .mount('#app');

import { createApp, h } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import AnalyticsView from '../../src/AnalyticsView.vue';
import { rememberClient } from '../../src/liveSource';
import { de, en } from '../../src/messages';
import { UI_ACTIONS_KEY } from '../../src/uiActions';
import { mockShop } from './shop';

/**
 * Mounts the analytics page the way the admin does (vue-i18n with `analytics.*`, a router) on a page with the theme
 * tokens of PEROXID. Query: `?theme=dark`, `?lang=de`, `?source=live` (the page asks a stand-in shop).
 */
declare global {
  interface Window {
    __shopCalls: Record<string, unknown>[];
    /** the path of the router after each navigation: the harness has no router-view, the spec reads it here */
    __route: string;
    /** the handlers the page registered for the admin's UI actions (the admin's `registerUiAction`) */
    __uiActions: Map<string, (args: Record<string, unknown>) => void | Promise<void>>;
  }
}

const query = new URLSearchParams(window.location.search);
document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const locale = query.get('lang') === 'de' ? 'de' : 'en';
document.documentElement.lang = locale;
// `?sidebar=open|folded` takes the width that the admin's sidebar takes from the content (harness.css)
if (query.get('sidebar') === 'open' || query.get('sidebar') === 'folded') {
  document.documentElement.dataset.sidebar = query.get('sidebar')!;
}
window.__shopCalls = [];
window.__route = '';
window.__uiActions = new Map();
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
router.afterEach((to) => {
  window.__route = to.path;
});
// the address of the harness page is the deep link: its query is the route query of the analytics page
const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { en: { analytics: en }, de: { analytics: de } },
});

const app = createApp({ render: () => h('main', [h(AnalyticsView)]) })
  .use(i18n)
  .use(router)
  .provide(UI_ACTIONS_KEY, {
    register: (id: string, handler: (args: Record<string, unknown>) => void | Promise<void>) => {
      window.__uiActions.set(id, handler);
      return () => window.__uiActions.delete(id);
    },
  });
void router
  .push({ path: '/analytics', query: Object.fromEntries(query) })
  .then(() => app.mount('#app'));

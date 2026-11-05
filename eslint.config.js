import eslint from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['coverage/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  prettier,
  { files: ['**/*.{ts,vue}'], languageOptions: { globals: globals.browser } },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      'vue/multi-word-component-names': 'off',
      // the plugin runs under oxid-fe-admin's CSP (Trusted Types): HTML is never assembled by hand
      'vue/no-v-html': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      // the admin keeps nothing in browser storage (ADR-002 of oxid-fe-admin); neither does a plugin
      'no-restricted-globals': [
        'error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
          name,
          message: 'The admin keeps nothing in browser storage.',
        })),
      ],
    },
  },
);

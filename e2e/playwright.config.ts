import { defineConfig, devices } from '@playwright/test';

/**
 * The mocked e2e of the plugin: the analytics page on a harness page (e2e/harness) with the PEROXID theme tokens and a
 * stand-in shop. `E2E_BASE_URL` points at an already running harness instead.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4276';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, testIdAttribute: 'data-test', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx vite --config vite.config.ts',
        url: 'http://localhost:4276',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const useExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: '.tmp/playwright-report', open: 'never' }], ['line']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: 'node --env-file=.env server.js',
          url: `${baseURL}/healthz`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      }),
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});

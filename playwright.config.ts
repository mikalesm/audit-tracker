import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Spawn the dev server with dev-bypass auth + a deterministic pglite dir.
        command: 'npm run dev -- -p ' + PORT,
        url: `${baseURL}/api/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          AUTH_DEV_BYPASS: '1',
          NEXTAUTH_SECRET: 'e2e-only-secret',
          NEXTAUTH_URL: baseURL,
          AUDITOR_LEAD_BOOTSTRAP_EMAILS: 'lead@example.test',
          DATABASE_URL: `pglite:${process.cwd()}/data/e2e-pgdata`,
        },
      },
});

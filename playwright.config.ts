import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);
// The container image pre-installs Chromium; elsewhere Playwright finds its own browsers.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

/** Device matrix from 04 §9: Pixel 7 (Chromium) and iPhone 14 (WebKit). */
export default defineConfig({
  testDir: '.',
  testMatch: ['apps/*/e2e/**/*.spec.ts'],
  forbidOnly: ci,
  retries: 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'pixel-7',
      use: {
        ...devices['Pixel 7'],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @margwise/web preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !ci,
    },
    {
      command: 'pnpm --filter @margwise/studio preview',
      url: 'http://localhost:4174',
      reuseExistingServer: !ci,
    },
  ],
});

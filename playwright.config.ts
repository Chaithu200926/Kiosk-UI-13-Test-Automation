// Playwright settings for the CinescapeKiosk UI tests.
// Playwright is only the test runner and report here; the kiosk (a Windows WPF app) is driven through Appium.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Test files live in tests/.
  testDir: './tests',
  // Start the API recorder and Appium once for the whole run.
  globalSetup: './src/global-setup.ts',
  // Screenshots, videos and other per-test files (the recorded API calls stay one level up).
  outputDir: 'test-results/artifacts',
  // There is one kiosk on this PC, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  // No retries: each test gets exactly one recording.
  retries: 0,
  // Starting the kiosk alone can take 30 s; booking flows take a few minutes.
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [
    // Progress in the terminal.
    ['list'],
    // HTML report with steps, screenshots and videos (npm run report).
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    // Machine-readable results for the dashboard.
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
});

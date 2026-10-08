import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.mjs",
  // Full-quality WebGL flows accumulate rendering/readback time on CI runners.
  // Keep individual operations bounded so this does not hide a stuck control.
  timeout: process.env.CI ? 300000 : 90000,
  globalTimeout: process.env.CI ? 20 * 60 * 1000 : undefined,
  expect: { timeout: 20000 },
  // Allow test-level sharding across CI jobs; each machine still draws one
  // full-quality WebGL flow at a time.
  fullyParallel: true,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/",
    viewport: { width: 1280, height: 900 },
    headless: true,
    actionTimeout: 30000,
    navigationTimeout: 30000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-report.json" }],
  ],
  webServer: [
    {
      command: "npm run preview -- --port 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "node_modules/.bin/vite --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "node scripts/serve-worker-test.mjs",
      url: "http://127.0.0.1:4175/",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});

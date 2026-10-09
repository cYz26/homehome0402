import { defineConfig } from "@playwright/test";
import viteConfig from "./vite.config.js";
const basePath = viteConfig.base;
const previewPort = process.env.HOME402_TEST_PORT ?? "4173";
const fixturePort = process.env.HOME402_FIXTURE_PORT ?? "4174";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.mjs",
  // Preserve the archived Workers tests without applying its password gate to Pages.
  testIgnore: "worker-auth.spec.mjs",
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
    baseURL: `http://127.0.0.1:${previewPort}${basePath}`,
    viewport: { width: 1280, height: 900 },
    headless: true,
    channel: "chromium",
    launchOptions: process.env.CI ? {
      args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist"],
    } : undefined,
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
      command: `npm run preview -- --port ${previewPort}`,
      url: `http://127.0.0.1:${previewPort}${basePath}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: `node_modules/.bin/vite --host 127.0.0.1 --port ${fixturePort}`,
      url: `http://127.0.0.1:${fixturePort}${basePath}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});

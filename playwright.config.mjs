import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.mjs",
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/homehome402/",
    viewport: { width: 1280, height: 900 },
    headless: true,
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
      url: "http://127.0.0.1:4173/homehome402/",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "node_modules/.bin/vite --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/homehome402/",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});

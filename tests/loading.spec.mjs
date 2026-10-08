import { test, expect } from "@playwright/test";

test("model download overlaps viewer code and cancellation stays responsive", async ({ page }) => {
  let releaseModule;
  const moduleGate = new Promise((resolve) => { releaseModule = resolve; });
  await page.route(/\/assets\/viewer-.*\.js$/, async (route) => {
    await moduleGate;
    await route.continue();
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The homepage can start this request before the first explicit click.
  const modelRequest = page.waitForRequest(/apartment-web\.glb$/, { timeout: 5000 });
  await page.goto("./");
  await expect(page.locator("#rooms button")).toHaveCount(11);
  try {
    await page.locator("[data-explore]").click({ noWaitAfter: true });
    await modelRequest;
    await page.locator("#cancel-model").click();
    await expect(page.locator("#loading-text")).toContainText("加载已取消");
    await expect(page.locator("canvas")).toHaveCount(0);
  } finally {
    releaseModule();
  }
  await page.locator("#load-model").click();
  await expect(page.locator("#model-placeholder")).toBeHidden({ timeout: 120000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("#quality")).toHaveValue("standard");
  expect(errors).toEqual([]);
});

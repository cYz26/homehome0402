import { test, expect } from "@playwright/test";

test("background resources wait for a delayed homepage hero", async ({ page }) => {
  let releaseHero;
  const gate = new Promise((resolve) => { releaseHero = resolve; });
  const requests = [];
  page.on("request", (r) => {
    if (/three-|apartment-web\.glb/.test(r.url())) requests.push(r.url());
  });
  await page.route("**/hero-*.webp", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#mini-plan svg")).toBeVisible();
    // Exceed the idle fallback deadline while the actual hero is still held.
    await page.waitForTimeout(1800);
    expect(requests).toEqual([]);
    await expect(page.locator("canvas")).toHaveCount(0);
  } finally {
    releaseHero();
  }
  await expect.poll(() => requests.some((url) => url.endsWith("apartment-web.glb")), { timeout: 5000 }).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
});

for (const width of [1280, 390]) {
  test(`homepage ${width}: preloads after the hero and reuses the pending model`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    let releaseModel;
    const gate = new Promise((resolve) => { releaseModel = resolve; });
    let probes = 0, hdRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("apartment-hd.glb")) hdRequests++;
      if (request.url().endsWith("apartment-web.glb") &&
        request.headers().range === "bytes=0-65535") probes++;
    });
    await page.route("**/apartment-web.glb", async (route) => {
      await gate;
      await route.continue();
    });
    const started = page.waitForRequest("**/apartment-web.glb", { timeout: 5000 });
    try {
      await page.goto("./");
      await started;
      expect(await page.locator("#hero-image").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.locator("#cancel-model")).toBeHidden();
      await expect(page.locator("#loading-text")).toContainText("从这里开始");
      await testInfo.attach(`preload-home-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await page.locator("[data-explore]").click({ noWaitAfter: true });
      await expect(page.locator("#cancel-model")).toBeVisible();
      expect(probes).toBe(1);
    } finally {
      releaseModel();
    }
    await expect(page.locator("#model-placeholder")).toBeHidden({ timeout: 120000 });
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("#quality")).toHaveValue("standard");
    expect(probes).toBe(1);
    expect(hdRequests).toBe(0);
  });
}

test("completed homepage preload is reused and does not create a renderer", async ({ page }) => {
  let modelRequests = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().endsWith("apartment-web.glb")) modelRequests++; });
  await page.goto("./");
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open("home402-models-v1");
    return (await cache.keys()).some((r) => r.url.includes("apartment-web.glb"));
  }), { timeout: 10000 }).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
  const downloaded = modelRequests;
  // The in-memory result must remain usable even if persistent cache is evicted.
  await page.evaluate(() => caches.delete("home402-models-v1"));
  await page.locator("[data-explore]").click();
  await expect(page.locator("#model-placeholder")).toBeHidden({ timeout: 120000 });
  expect(modelRequests).toBe(downloaded);
  expect(errors).toEqual([]);
});

test("background preload failure leaves the homepage usable and explicit entry retries", async ({ page }) => {
  let failures = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/apartment-web.glb", (route) => {
    failures++;
    return route.fulfill({ status: 503, body: "unavailable" });
  });
  await page.goto("./");
  await expect.poll(() => failures, { timeout: 5000 }).toBe(2);
  await expect(page.locator("#hero-image")).toBeVisible();
  await expect(page.locator("#site-status")).toBeHidden();
  await expect(page.locator("#cancel-model")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.unroute("**/apartment-web.glb");
  await page.locator("[data-explore]").click();
  await expect(page.locator("#model-placeholder")).toBeHidden({ timeout: 120000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

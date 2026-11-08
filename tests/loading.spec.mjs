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

test("a rejected first frame keeps the model preview and allows retry", async ({ page }) => {
  await page.addInitScript(() => {
    const context = WebGL2RenderingContext.prototype;
    const shaderSource = context.shaderSource;
    context.shaderSource = function (shader) {
      shaderSource.call(this, shader, "#version 300 es\n#error test shader rejection\n");
    };
    window.addEventListener("restore-shaders", () => {
      context.shaderSource = shaderSource;
    }, { once: true });
  });
  await page.goto("./");
  await page.locator("[data-explore]").click();
  const placeholder = page.locator("#model-placeholder");
  await expect(page.locator("#loading-text")).toContainText(
    "当前浏览器无法完成三维绘制",
    { timeout: 120000 },
  );
  await expect(placeholder.locator("img")).toBeVisible();
  await expect(page.locator("#canvas-container canvas")).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event("restore-shaders")));
  await page.locator("#load-model").click();
  await expect(placeholder).toBeHidden({ timeout: 120000 });
  await expect(page.locator("#canvas-container canvas")).toHaveCount(1);
});

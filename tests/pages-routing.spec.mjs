import { test, expect } from "@playwright/test";

test("public project page keeps images, downloads and model ranges under its repository base", async ({ page, request, baseURL }) => {
  expect(new URL(baseURL).pathname).toBe("/homehome0402/");
  const response = await request.get("release.json");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  for (const file of [manifest, ...(manifest.additionalModels ?? [])].flatMap((p) => [p.model, p.rawModel])) {
    const range = await request.get(file, { headers: { Range: "bytes=0-127" } });
    expect(range.status(), file).toBe(206);
    expect((await range.body()).length).toBe(128);
    expect(range.headers()["content-range"]).toBe(`bytes 0-127/${manifest.assets.find((a) => a.path === file).bytes}`);
  }
  await page.goto("./");
  await expect(page.locator("#hero-image")).toBeVisible();
  await expect(page.locator("#rooms button")).toHaveCount(11);
  const resources = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll("img"), (e) => e.currentSrc || e.src).filter(Boolean),
    ...Array.from(document.querySelectorAll("a[href]"), (e) => e.href)
      .filter((url) => /release\.json|\/releases\//.test(url)),
  ]);
  expect(resources.length).toBeGreaterThan(4);
  for (const url of resources) expect(url.startsWith(baseURL), url).toBe(true);
});

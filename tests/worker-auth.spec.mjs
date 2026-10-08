import { test, expect } from "@playwright/test";

for (const [name, width, height] of [["desktop", 1280, 900], ["phone", 390, 844]]) {
  test(`${name}: password gate protects assets and restores the shared view`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const state = { v: 1, mode: "top", quality: "smooth", section: { axis: "z", value: 1.15 } };
    const fragment = `#view=${encodeURIComponent(JSON.stringify(state))}`;
    await page.goto(`http://127.0.0.1:4175/${fragment}`);
    await expect(page).toHaveTitle("Home 402 · 访问空间档案");
    await expect(page.getByRole("heading", { name: "家的空间档案" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach(`password-${name}`, { body: await page.screenshot(), contentType: "image/png" });
    expect((await page.request.get("http://127.0.0.1:4175/release.json")).status()).toBe(401);
    await page.getByLabel("访问密码").fill("wrong-password");
    await page.getByRole("button", { name: "进入空间" }).click();
    await expect(page.getByRole("alert")).toHaveText("密码不正确，请重新输入。");
    await page.getByLabel("访问密码").fill("home402-browser-test-only");
    await page.getByRole("button", { name: "进入空间" }).click();
    await expect(page.locator("#model-placeholder")).toBeHidden({ timeout: 120000 });
    await expect(page.locator("canvas")).toHaveCount(1);
    // The viewer canonicalizes a restored URL with camera/default fields after
    // 600 ms. Read its actual snapshot instead of racing that URL update.
    await page.locator("#share").click();
    const shared = await page.locator("#share-url").inputValue();
    const restored = JSON.parse(decodeURIComponent(new URL(shared).hash.slice(6)));
    expect(restored).toMatchObject(state);
    await page.locator("#share-dialog [data-close-dialog]").click();
    // The browser treats localhost as secure for cookies; Playwright's separate
    // HTTP client does not. Exercise the actual browser's credential path.
    const manifest = await page.evaluate(async () => {
      const response = await fetch('/release.json');
      if (response.status !== 200) throw Error('Authenticated manifest unavailable');
      return response.json();
    });
    const range = await page.evaluate(async (model) => {
      const response = await fetch(`/${model}`, { headers: { Range: 'bytes=0-65535' } });
      return { status: response.status, contentRange: response.headers.get('Content-Range'), bytes: (await response.arrayBuffer()).byteLength };
    }, manifest.model);
    expect(range.status).toBe(206);
    expect(range.contentRange).toMatch(/^bytes 0-65535\//);
    expect(range.bytes).toBe(65536);
    await testInfo.attach(`password-${name}-opened`, { body: await page.screenshot(), contentType: "image/png" });
    expect(errors).toEqual([]);
    await page.context().clearCookies();
    await page.reload();
    await expect(page.getByLabel("访问密码")).toBeVisible();
    expect((await page.request.get(`http://127.0.0.1:4175/${manifest.model}`, { headers: { Range: "bytes=0-65535" } })).status()).toBe(401);
  });
}

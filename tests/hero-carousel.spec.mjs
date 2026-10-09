import { test, expect } from "@playwright/test";

const selected = ["scheme-overview", "living", "scheme-tv-c-close", "scheme-study",
  "study", "scheme-study-cabinet", "study-cabinet", "kitchen", "master", "masterbath"];
const current = (page, id) => expect(page.locator("#hero-image")).toHaveAttribute("data-image-id", id);
async function ready(page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hero-dots button")).toHaveCount(10);
  await expect.poll(() => page.locator("#hero-image").evaluate((image) =>
    image.complete && image.naturalWidth > 1000)).toBe(true);
}

for (const [label, width, height] of [["desktop", 1280, 900], ["phone", 390, 844]]) {
  test(`homepage carousel ${label}: current effects and interior scenes, controls and labels`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page);
    await expect(page.locator("#hero-play")).toHaveAccessibleName("播放轮播");
    const ids = await page.locator("#hero-dots button").evaluateAll((buttons) => buttons.map((button) => button.dataset.heroSlide));
    expect(ids).toEqual(selected);
    const manifest = await page.request.get("release.json").then((response) => response.json());
    const images = ids.map((id) => manifest.images.find((image) => image.id === id));
    expect(images.every((image) => image.kind === "模型渲染" || image.kind.startsWith("AI"))).toBe(true);
    expect(ids.some((id) => /photo|plan|reference|scheme-tv-[ab]$/.test(id))).toBe(false);
    for (const [i, image] of images.entries()) {
      await page.locator(`[data-hero-slide="${image.id}"]`).click();
      await current(page, image.id);
      await expect(page.locator("#hero-image")).toHaveAttribute("src", new RegExp(`/${image.id}\\.webp$`));
      await expect(page.locator("#hero-count")).toHaveText(`${String(i + 1).padStart(2, "0")} / 10`);
      await expect(page.locator("#hero-kind")).toContainText(image.kind === "模型渲染" ? "模型渲染" : "AI 效果图");
      await expect(page.locator(`[data-hero-slide="${image.id}"]`)).toHaveAttribute("aria-pressed", "true");
      expect(await page.locator("#hero-image").evaluate((image) => image.complete && image.naturalWidth > 1000)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (["scheme-overview", "scheme-study", "study-cabinet"].includes(image.id))
        await testInfo.attach(`carousel-${label}-${image.id}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    await page.locator("#hero-next").click();
    await current(page, selected[0]);
    await page.locator("#hero-prev").click();
    await current(page, selected.at(-1));
    await page.keyboard.press("ArrowRight");
    await current(page, selected[0]);
    if (label === "phone") {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      const box = await page.locator("#hero-image").boundingBox();
      const y = box.y + box.height / 2;
      const point = (x) => [{ x: box.x + x, y, id: 1 }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(280) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(220) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await current(page, selected[0]);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(280) });
      for (const x of [230, 180, 130, 80]) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x) });
        await page.waitForTimeout(30);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await current(page, "living");
      await cdp.detach();
    }
    expect(errors).toEqual([]);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
}

test("homepage carousel: autoplay, pause and reduced motion", async ({ page }) => {
  await page.clock.install();
  await ready(page);
  await page.mouse.move(1, 1);
  await page.clock.fastForward(6500);
  await current(page, "living");
  await page.locator("#hero-play").click();
  await expect(page.locator("#hero-play")).toHaveAccessibleName("播放轮播");
  await page.mouse.move(1, 1);
  await page.clock.fastForward(7000);
  await current(page, "living");
  await page.locator("#hero-play").click();
  await page.mouse.move(1, 1);
  await page.clock.fastForward(6500);
  await current(page, "scheme-tv-c-close");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#hero-play")).toHaveAccessibleName("播放轮播");
  await page.clock.fastForward(7000);
  await current(page, "scheme-tv-c-close");
});

test("homepage carousel: delayed selection cannot overwrite a newer choice and failures can retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/scheme-study.webp", async (route) => { await gate; await route.continue(); });
  try {
    await ready(page);
    await page.locator('[data-hero-slide="scheme-study"]').click();
    await expect(page.locator("#home-gallery")).toHaveAttribute("aria-busy", "true");
    await current(page, "scheme-overview");
    await page.locator('[data-hero-slide="scheme-tv-c-close"]').click();
    await current(page, "scheme-tv-c-close");
    const completed = page.waitForResponse("**/scheme-study.webp");
    release();
    await completed;
    await expect(page.locator("#home-gallery")).toHaveAttribute("aria-busy", "false");
    await current(page, "scheme-tv-c-close");
  } finally { release(); }
  await page.route("**/scheme-study-cabinet.webp", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.locator('[data-hero-slide="scheme-study-cabinet"]').click();
  await expect(page.locator("#hero-error")).toBeVisible();
  await current(page, "scheme-tv-c-close");
  await expect(page.locator("#hero-kind")).toContainText("AI 效果图");
  await page.unroute("**/scheme-study-cabinet.webp");
  await page.locator("#hero-retry").click();
  await current(page, "scheme-study-cabinet");
  await expect(page.locator("#hero-error")).toBeHidden();
  await expect(page.locator("#hero-kind")).toContainText("AI 效果图");
});

import { test, expect } from "@playwright/test";

const fixture =
  "http://127.0.0.1:4174/homehome402/tests/fixtures/section-probe.html";
test.use({ deviceScaleFactor: 2 });
test("section caps stay flat through zoom with full AO, shadows and both model packages", async ({
  page,
}, testInfo) => {
  test.setTimeout(process.env.CI ? 300000 : 180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const metrics = [];
  // Positive control: the old single-material AO prepass must reproduce the bug.
  await page.goto(`${fixture}?asset=web&legacy`);
  await page.waitForFunction(() => window.ready);
  const before = await page.evaluate(() => window.probe({ zoom: 1.7 }));
  expect(before.sampleCount).toBeGreaterThan(80);
  expect(before.range).toBeGreaterThan(10);
  await testInfo.attach("section-before-ao-mismatch", {
    body: Buffer.from(before.image.split(",")[1], "base64"),
    contentType: "image/png",
  });
  metrics.push({ asset: "web", legacy: true, range: before.range });
  for (const asset of ["web", "hd"]) {
    await page.goto(`${fixture}?asset=${asset}`);
    await page.waitForFunction(() => window.ready);
    for (const zoom of [0.9, 1.7, 2.6]) {
      const r = await page.evaluate((o) => window.probe(o), { zoom });
      expect(r.sampleCount).toBeGreaterThan(80);
      expect(r.quality.ao).toBe(true);
      expect(r.quality.shadow).toBe(true);
      expect(
        r.range,
        `${asset}, zoom ${zoom}: a flat cap must not have dark stripes`,
      ).toBeLessThanOrEqual(3);
      expect(r.quality.pixelRatio).toBe(r.quality.nativePixelRatio);
      expect(r.quality.samples).toBeGreaterThanOrEqual(4);
      metrics.push({
        asset,
        zoom,
        range: r.range,
        sampleCount: r.sampleCount,
        quality: r.quality,
      });
      await testInfo.attach(`section-${asset}-zoom-${zoom}`, {
        body: Buffer.from(r.image.split(",")[1], "base64"),
        contentType: "image/png",
      });
    }
    for (const [axis, value] of [
      ["x", 0.04],
      ["y", 8.9],
      ["z", 1.4],
    ]) {
      const r = await page.evaluate((o) => window.probe(o), {
        axis,
        value,
        zoom: 1.7,
      });
      expect(r.sampleCount).toBeGreaterThan(80);
      expect(r.range, `${asset}, ${axis} cut ${value}`).toBeLessThanOrEqual(3);
      metrics.push({
        asset,
        axis,
        value,
        range: r.range,
        sampleCount: r.sampleCount,
      });
      await testInfo.attach(`section-${asset}-${axis}-${value}`, {
        body: Buffer.from(r.image.split(",")[1], "base64"),
        contentType: "image/png",
      });
    }
  }
  expect(errors).toEqual([]);
  await testInfo.attach("section-metrics", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
});

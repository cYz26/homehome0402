import { test, expect } from "@playwright/test";
import sharp from "sharp";
// Downloading, decoding and the first full-quality render are one loading
// phase. A request event only marks its start; ordinary UI assertions stay 20s.
async function modelReady(page) {
  await test.step("model ready: download, decode and first render", async () => {
    // Read both conditions atomically. On the private runner, HD finishes its
    // first render at ~96s, then a second DOM request can wait behind another
    // software-GPU frame and consume the remainder of this 120s phase.
    await expect.poll(() => page.evaluate(() => ({
      placeholderHidden: document.querySelector("#model-placeholder")?.hidden === true,
      canvasCount: document.querySelectorAll("canvas").length,
    })), { timeout: 120000 }).toEqual({ placeholderHidden: true, canvasCount: 1 });
  }, { timeout: 120000 });
}
async function ready(page) {
  await page.locator("[data-explore]").click();
  await modelReady(page);
  await expect(page.locator("canvas")).toBeVisible();
}
async function view(page) {
  await page.locator("#share").click();
  const href = await page.locator("#share-url").inputValue();
  await page.locator("#share-dialog [data-close-dialog]").click();
  return {
    href,
    state: JSON.parse(decodeURIComponent(new URL(href).hash.slice(6))),
  };
}
async function panel(page, open) {
  const expanded =
    (await page.locator("#inspector-panel").getAttribute("open")) !== null;
  if (expanded !== open) await page.locator("#inspector-panel summary").click();
}
async function nonblank(page, testInfo, name) {
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const png = await canvas.screenshot();
  const stats = await sharp(png).stats();
  expect(
    Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev)),
  ).toBeGreaterThan(10);
  await testInfo.attach(name, { body: png, contentType: "image/png" });
}
// Rendering may block animation frames while software GPUs compile/draw a new
// view. Give that work its own named budget, then use normal 30s UI actions.
async function rendered(page, name) {
  await test.step(`render complete: ${name}`, async () => {
    await page.evaluate(async () => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      if (!gl || gl.isContextLost()) throw new Error("WebGL context unavailable");
      // Drain the viewer's three trailing frames plus one presentation frame,
      // including GPU completion. Animated camera transitions remain enabled
      // in the responsive interaction flows.
      for (let frame = 0; frame < 4; frame++) {
        await new Promise(requestAnimationFrame);
        gl.finish();
        if (gl.isContextLost()) throw new Error("WebGL context lost during render");
      }
    });
  }, { timeout: 120000 });
}
for (const [label, width, height] of [
  ["desktop", 1280, 900],
  ["tablet", 820, 1180],
  ["phone", 390, 844],
]) {
  test(`${label}: homepage preload, model, linked rooms, section, view restore, screenshot`, async ({
    page,
  }, testInfo) => {
    // Remote traces on the private runner spend over four minutes in this
    // animated flow before its final detail view. Keep each action/render bound.
    if (process.env.CI) test.setTimeout(420000);
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto("./");
    await expect(page.locator("#rooms button")).toHaveCount(11);
    await expect(page.locator("#hero-image")).toBeVisible();
    // Homepage idle time may download resources; rendering starts on entry.
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await testInfo.attach(`${label}-home`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await ready(page);
    await page.locator("#quality").selectOption("smooth");
    await nonblank(page, testInfo, `${label}-orbit`);
    if (width < 700) await panel(page, true);
    await page.locator('#mini-plan [data-room-id="master"] .room').click();
    await expect(page.locator('#rooms [data-room="master"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#properties")).toContainText("模型估算");
    await page.locator('#mini-plan [data-entity-id="door_master"]').click();
    await expect(page.locator("#properties")).toContainText("主卧房门");
    await page.locator("#section-axis").selectOption("x");
    await page.locator("#section-range").fill("4.25");
    await expect(page.locator("#section-value")).toContainText("4.25");
    if (width < 700) await panel(page, false);
    const saved = await view(page);
    expect(saved.state.entityId).toBe("door_master");
    expect(saved.state.section).toEqual({ axis: "x", value: 4.25 });
    await page.goto(saved.href);
    await page.reload();
    await modelReady(page);
    await expect(page.locator("#viewer-shell")).toHaveAttribute(
      "data-entity",
      "door_master",
    );
    const restored = await view(page);
    expect(restored.state.section).toEqual(saved.state.section);
    expect(restored.state.camera.position).toEqual(saved.state.camera.position);
    await nonblank(page, testInfo, `${label}-section`);
    const download = page.waitForEvent("download");
    await page.locator("#screenshot").click();
    expect((await download).suggestedFilename()).toMatch(/home402.*\.png/);
    await page.locator('[data-mode="walk"]').click();
    await expect(page.locator("#eye-height")).toHaveText("视线 1.65 m");
    const before = await view(page);
    await page.locator("canvas").focus();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(450);
    await page.keyboard.up("KeyW");
    await page.keyboard.down("KeyE");
    await page.waitForTimeout(300);
    await page.keyboard.up("KeyE");
    const after = await view(page);
    expect(after.state.camera.position[2]).toBeLessThan(
      before.state.camera.position[2],
    );
    expect(after.state.eyeHeight).toBeGreaterThan(1.7);
    await page.locator("canvas").focus();
    await page.keyboard.down("KeyW");
    await page.locator("canvas").dispatchEvent("blur");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyW");
    const stopped = await view(page);
    await page.waitForTimeout(200);
    const stoppedAgain = await view(page);
    expect(stoppedAgain.state.camera.position).toEqual(
      stopped.state.camera.position,
    );
    await page.locator('[data-mode="interior"]').click({ noWaitAfter: true });
    await rendered(page, `${label} interior`);
    if (width < 700) await panel(page, true);
    await page.locator('#rooms [data-room="masterbath"]').click({ noWaitAfter: true });
    await rendered(page, `${label} master bathroom`);
    await page.locator('[data-detail="double-basin"]').click({ noWaitAfter: true });
    await rendered(page, `${label} double basin`);
    if (width < 700) await panel(page, false);
    await nonblank(page, testInfo, `${label}-bathroom`);
    await page.locator("[data-open-references]").first().click();
    await expect(page.locator("#reference-caption")).toContainText("模型渲染");
    await expect(page.locator("#reference-image")).toHaveAttribute(
      "src",
      /\/reference\.webp$/,
    );
    await page.locator("#reference-dialog [data-close-dialog]").click();
    await page.locator("#documents").scrollIntoViewIfNeeded();
    for (const link of await page.locator("#downloads a").all()) {
      const response = await page.request.head(await link.getAttribute("href"), {
        timeout: 15000,
      });
      expect(response.ok()).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
test("mobile touch: immediate two-axis look, stationary hold, two-finger height and release safety", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await ready(page);
  await page.locator("#quality").selectOption("smooth");
  await page.locator('[data-mode="walk"]').click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const initial = await view(page);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const b = await page.locator("canvas").boundingBox(),
    x = b.x + b.width * 0.5,
    y = b.y + b.height * 0.55;
  const cdp = await context.newCDPSession(page);
  const touch = async (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map(([id, x, y]) => ({
        id,
        x,
        y,
        radiusX: 1,
        radiusY: 1,
        force: 1,
      })),
    });
  await touch("touchStart", [[1, x, y]]);
  await touch("touchMove", [[1, x + 35, y - 30]]);
  await touch("touchEnd", []);
  const looking = await view(page);
  expect(looking.state.camera.position).toEqual(initial.state.camera.position);
  expect(looking.state.camera.target[0]).not.toBe(
    initial.state.camera.target[0],
  );
  expect(looking.state.camera.target[1]).toBeGreaterThan(
    initial.state.camera.target[1],
  );
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await touch("touchStart", [[1, x, y]]);
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
  await touch("touchEnd", []);
  const walked = await view(page);
  expect(walked.state.camera.position).not.toEqual(
    looking.state.camera.position,
  );
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await touch("touchStart", [
    [1, x - 30, y],
    [2, x + 30, y],
  ]);
  await page.waitForTimeout(400);
  await touch("touchMove", [
    [1, x - 30, y - 40],
    [2, x + 30, y - 40],
  ]);
  await touch("touchEnd", [[1, x - 30, y - 40]]);
  await page.waitForTimeout(400);
  await touch("touchEnd", []);
  const raised = await view(page);
  expect(raised.state.eyeHeight).toBeGreaterThan(walked.state.eyeHeight);
  expect(raised.state.camera.position[0]).toBe(walked.state.camera.position[0]);
  expect(raised.state.camera.position[2]).toBe(walked.state.camera.position[2]);
  await nonblank(page, testInfo, "mobile-touch-walk");
  await context.close();
});
test("configuration failure and explicit retry recover without a reload", async ({
  page,
}) => {
  await page.route("**/release.json", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("./");
  await expect(page.locator("#site-status")).toBeVisible();
  await page.unroute("**/release.json");
  await page.locator("#retry-site").click();
  await expect(page.locator("#site-status")).toBeHidden();
  await expect(page.locator("#rooms button")).toHaveCount(11);
});
test("model failure, retry, cancellation and re-entry keep a single canvas", async ({
  page,
}) => {
  await page.route("**/apartment-web.glb", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("./");
  await page.locator("[data-explore]").click();
  await expect(page.locator("#loading-text")).toContainText("暂时无法载入");
  await page.unroute("**/apartment-web.glb");
  await page.locator("#load-model").click();
  await modelReady(page);
  await page.locator(".help summary").click();
  await page.locator("#reload-model").click();
  await page.locator("#cancel-model").click();
  await expect(page.locator("#loading-text")).toContainText("取消");
  await page.locator("#load-model").click();
  await modelReady(page);
});

test("standard rendering, north-up plan, current reference and on-demand HD retain the selected view", async ({
  page,
}, testInfo) => {
  // This case checks final full-quality views; animated navigation remains
  // covered by the desktop/tablet/phone flows with normal motion.
  // The remote trace completes Web views in 212s; HD then adds a 25s network
  // delay, decoding and three full-quality views. UI/phase limits stay intact.
  if (process.env.CI) test.setTimeout(600000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await page.goto("./");
  await ready(page);
  await rendered(page, "web orbit");
  await expect(page.locator("#quality")).toHaveValue("standard");
  await nonblank(page, testInfo, "standard-orbit");
  await page.locator('[data-mode="top"]').click({ noWaitAfter: true });
  await rendered(page, "web top");
  const top = await view(page);
  expect(top.state.mode).toBe("top");
  expect(
    Math.abs(top.state.camera.position[0] - top.state.camera.target[0]),
  ).toBeLessThan(0.01);
  expect(
    Math.abs(top.state.camera.position[2] - top.state.camera.target[2]),
  ).toBeLessThan(0.01);
  await nonblank(page, testInfo, "standard-top");
  await page.locator('#mini-plan [data-entity-id="door_master"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#properties")).toContainText("主卧房门");
  await page.locator('[data-mode="interior"]').click({ noWaitAfter: true });
  await rendered(page, "web interior");
  await page.locator('#rooms [data-room="masterbath"]').click({ noWaitAfter: true });
  await rendered(page, "web master bathroom");
  await page.locator('[data-detail="double-basin"]').click({ noWaitAfter: true });
  await rendered(page, "web double basin");
  await nonblank(page, testInfo, "web-bathroom-standard");
  const before = await view(page);
  await page.locator(".help summary").click();
  // Regression: a successful model load can exceed the ordinary 20s UI
  // assertion budget. Keep the real HD asset and all full-quality checks.
  await page.route("**/apartment-hd.glb", async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 25000));
    await route.fulfill({ response });
  });
  const hd = page.waitForRequest("**/apartment-hd.glb");
  await page.locator("#load-hd").click({ noWaitAfter: true });
  await hd;
  await modelReady(page);
  await rendered(page, "HD double basin");
  const after = await view(page);
  expect(after.state.mode).toBe(before.state.mode);
  expect(after.state.camera.position).toEqual(before.state.camera.position);
  await nonblank(page, testInfo, "hd-bathroom-standard");
  await page.locator('[data-mode="top"]').click({ noWaitAfter: true });
  await page.locator('button[data-room=""]').click({ noWaitAfter: true });
  await rendered(page, "HD top");
  await nonblank(page, testInfo, "hd-top");
  await page.locator('[data-mode="orbit"]').click({ noWaitAfter: true });
  await rendered(page, "HD orbit");
  await nonblank(page, testInfo, "hd-orbit");
  await page.locator("[data-open-references]").first().click();
  await expect(page.locator("#reference-image")).toHaveAttribute(
    "src",
    /\/reference\.webp$/,
  );
  await expect
    .poll(() =>
      page
        .locator("#reference-image")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await testInfo.attach("current-model-reference", {
    body: await page.locator("#reference-dialog").screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import sharp from "sharp";
// Study flow covers its independent package, source-labelled images and stable
// entity queries through the real UI at desktop and mobile widths.
for (const [label,width,height] of [["desktop",1280,900],["phone",390,844]]) {
  test(`study ${label}: confirmed images, complete 3D and furniture properties`, async ({page},testInfo)=>{
    test.setTimeout(process.env.CI ? 420000 : 180000);
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:"reduce"});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
    await page.goto("./");
    await expect(page).toHaveTitle(/402/);
    await expect(page.locator("#hero-image")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const [id,file] of [["scheme-study","scheme-study"],["scheme-study-cabinet","scheme-study-cabinet"]]) {
      await page.locator(`[data-reference="${id}"]`).first().click();
      await expect(page.locator("#reference-dialog")).toBeVisible();
      await expect(page.locator("#reference-image")).toHaveAttribute("src",new RegExp(`/${file}\\.webp$`));
      await expect(page.locator("#reference-caption")).toContainText("用户已确认");
      await expect.poll(()=>page.locator("#reference-image").evaluate(e=>e.complete&&e.naturalWidth>1000)).toBe(true);
      await page.locator("#reference-dialog [data-close-dialog]").click();
    }
    await ready(page);
    if(width<700)await panel(page,true);
    await page.locator('#rooms [data-room="xroom"]').click({noWaitAfter:true});
    await page.locator('[data-mode="interior"]').click({noWaitAfter:true});
    if(width<700)await panel(page,true);
    await page.locator('[data-detail="study"]').click({noWaitAfter:true});
    await nonblank(page,testInfo,`study-${label}-interior`);
    if(width<700)await panel(page,true);
    for(const [id,text] of [["study-bookcase","可坐深底柜"],["study-standing-desk","140×70"],["study-task-chair","网背转椅"],["study-side-cabinet","东侧配柜"]]) {
      await page.locator(`#mini-plan [data-entity-id="${id}"]`).click();
      await expect(page.locator("#properties")).toContainText(text);
    }
    await page.locator('#mini-plan [data-entity-id="study-bookcase"]').click();
    await expect(page.locator("#properties")).toContainText("先移");
    const release=await page.request.get("release.json").then(r=>r.json());
    expect(release.additionalModels.map(p=>p.id)).toContain("study");
    expect(errors).toEqual([]);
    expect(await page.locator("vite-error-overlay").count()).toBe(0);
  });
}
// Downloading, decoding and the first full-quality render are one loading
// phase. A request event only marks its start; ordinary UI assertions stay 20s.
async function modelReady(page, timeout = 120000, name = "model") {
  await test.step(`${name} ready: download, decode and first render`, async () => {
    // Read both conditions atomically. A remote trace showed first-render
    // completion followed by a second DOM request waiting behind another
    // software-GPU frame and exhausting this shared 120s phase.
    await expect.poll(() => page.evaluate(() => ({
      placeholderHidden: document.querySelector("#model-placeholder")?.hidden === true,
      canvasCount: document.querySelectorAll("canvas").length,
    })), { timeout }).toEqual({ placeholderHidden: true, canvasCount: 1 });
  }, { timeout });
}
async function ready(page) {
  await page.locator("[data-explore]").click();
  await modelReady(page);
  await expect(page.locator("canvas")).toBeVisible();
}
async function view(page) {
  await rendered(page, "share view");
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
  const timeout = process.env.CI ? 240000 : 120000;
  const png = await test.step(`pixel readback: ${name}`, async () => {
    const canvas = page.locator("canvas");
    // Scrolling can resume a paused viewer, so drain its frame after scrolling.
    // Readback/stability on a software GPU belongs to the render phase.
    await canvas.scrollIntoViewIfNeeded({ timeout });
    await rendered(page, name, timeout);
    return canvas.screenshot({ timeout });
  }, { timeout });
  const stats = await sharp(png).stats();
  expect(
    Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev)),
  ).toBeGreaterThan(10);
  await testInfo.attach(name, { body: png, contentType: "image/png" });
}
// Rendering may block animation frames while software GPUs compile/draw a new
// view. Give that work its own named budget, then use normal 30s UI actions.
async function rendered(page, name, timeout = process.env.CI ? 240000 : 120000) {
  await test.step(`render complete: ${name}`, async () => {
    await page.bringToFront();
    await page.evaluate(async () => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      if (!gl || gl.isContextLost()) throw new Error("WebGL context unavailable");
      // Cover camera updates and presentation, including GPU completion.
      // Static views now render once; transitions still invalidate each frame.
      // Animated camera transitions remain enabled in the responsive flows.
      for (let frame = 0; frame < 4; frame++) {
        await new Promise(requestAnimationFrame);
        gl.finish();
        if (gl.isContextLost()) throw new Error("WebGL context lost during render");
      }
    });
  }, { timeout });
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
    await rendered(page, `${label} quality switch`);
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
    try {
      // Software rendering may not sample a 300ms key hold even once. Keep the
      // real key held until the displayed height confirms movement, bounded by
      // the ordinary input budget; retain the same height assertion below.
      await expect.poll(async () => Number(
        (await page.locator("#eye-height").textContent()).match(/[\d.]+/)[0],
      ), { timeout: 30000 }).toBeGreaterThan(1.7);
    } finally {
      await page.keyboard.up("KeyE");
    }
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
    await expect(page.locator("#reference-caption")).toContainText("AI 方案效果图");
    await expect(page.locator("#reference-image")).toHaveAttribute(
      "src",
      /\/scheme-overview\.webp$/,
    );
    await expect(page.locator('#reference-tabs [data-reference="reference"], #reference-tabs [data-reference="cabinet"], #reference-tabs [data-reference="table"], #reference-tabs [data-reference="scheme-cabinet-v02"], #reference-tabs [data-reference="archive"]')).toHaveCount(0);
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
  await page.goto(testInfo.project.use.baseURL);
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

test("secondary furniture package failure retries with complete semantic ownership", async ({page}) => {
  await page.route("**/living-sofa-web.glb", r => r.fulfill({status:503,body:"unavailable"}));
  await page.goto("./");
  await page.locator("[data-explore]").click();
  await expect(page.locator("#loading-text")).toContainText("暂时无法载入");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.unroute("**/living-sofa-web.glb");
  await page.locator("#load-model").click();
  await modelReady(page);
  await page.locator('#mini-plan [data-entity-id="living-sofa"]').click();
  await expect(page.locator("#properties")).toContainText("沙发原始皮面与木框");
  const result = await view(page);
  expect(result.state.entityId).toBe("living-sofa");
});

test("standard rendering, north-up plan, current reference and on-demand HD retain the selected view", async ({
  page,
}, testInfo) => {
  // This case checks final full-quality views; animated navigation remains
  // covered by the desktop/tablet/phone flows with normal motion.
  // The private runner decodes raw HD textures for ~40s after the injected
  // 25s download delay, leaving under 50s of the old phase for software drawing.
  // HD phases keep their own bound; normal UI and Web phase limits remain.
  // The whole local Web + HD workflow also includes the intentional 25s delay.
  // Its former 90s limit cancelled HD while its own 120s phase still had time.
  test.setTimeout(process.env.CI ? 900000 : 240000);
  const hdPhaseTimeout = process.env.CI ? 240000 : 120000;
  const hdTimings = {};
  const hdRendered = async (name) => {
    const start = Date.now();
    await rendered(page, name, hdPhaseTimeout);
    hdTimings[name] = Date.now() - start;
  };
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
  let delayedHdResponse = false;
  await page.route("**/apartment-hd.glb", async (route) => {
    const delay = !delayedHdResponse;
    delayedHdResponse = true;
    const response = await route.fetch();
    // Delay once: the loader probes Range before its parallel segment requests.
    // Delaying every response accidentally makes this a 50s network stall.
    if (delay) await new Promise((resolve) => setTimeout(resolve, 25000));
    await route.fulfill({ response });
  });
  const hd = page.waitForRequest("**/apartment-hd.glb");
  await page.locator("#load-hd").click({ noWaitAfter: true });
  await hd;
  const hdStart = Date.now();
  await modelReady(page, hdPhaseTimeout, "HD model");
  hdTimings.loadMs = Date.now() - hdStart;
  await hdRendered("HD double basin");
  const after = await view(page);
  expect(after.state.mode).toBe(before.state.mode);
  expect(after.state.camera.position).toEqual(before.state.camera.position);
  await nonblank(page, testInfo, "hd-bathroom-standard");
  await page.locator('[data-mode="top"]').click({ noWaitAfter: true });
  await page.locator('button[data-room=""]').click({ noWaitAfter: true });
  await hdRendered("HD top");
  await nonblank(page, testInfo, "hd-top");
  await page.locator('[data-mode="orbit"]').click({ noWaitAfter: true });
  await hdRendered("HD orbit");
  await nonblank(page, testInfo, "hd-orbit");
  await page.locator("[data-open-references]").first().click();
  await expect(page.locator("#reference-image")).toHaveAttribute(
    "src",
    /\/scheme-overview\.webp$/,
  );
  await expect
    .poll(() =>
      page
        .locator("#reference-image")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await testInfo.attach("current-design-reference", {
    body: await page.locator("#reference-dialog").screenshot(),
    contentType: "image/png",
  });
  await testInfo.attach("HD phase timings", {
    body: Buffer.from(JSON.stringify({ phaseBudgetMs: hdPhaseTimeout, injectedNetworkDelayMs: 25000, ...hdTimings })),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";

test("walk canvas owns long-press defaults and releases input on interruption", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the real DOM input adapter and stylesheet without loading WebGL.
  await page.route("**/walk-input-fixture", (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><meta name="viewport" content="width=device-width">
      <link rel="stylesheet" href="/homehome402/src/style.css">
      <div class="stage"><canvas tabindex="0"></canvas><span class="compass">North</span></div>
      <p id="outside">House description remains selectable</p>
      <script type="module">
        import { WalkInput } from '/homehome402/src/walk-input.js';
        const canvas = document.querySelector('canvas');
        window.active = true;
        window.defaults = [];
        window.selected = 0;
        window.input = new WalkInput(canvas, {
          active: () => window.active, manual() {}, look() {}, height() {},
          select() { window.selected++; }, zoom() {}, exit() {},
        });
        for (const type of ['touchstart', 'touchmove'])
          canvas.addEventListener(type, (event) => window.defaults.push({
            type, prevented: event.defaultPrevented, cancelable: event.cancelable,
          }));
      </script>`,
  }));
  try {
    await page.goto("http://127.0.0.1:4174/homehome402/walk-input-fixture");
    await page.waitForFunction(() => window.input);
    const cdp = await context.newCDPSession(page);
    const touch = (type, points = []) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: points.map(([x, y]) => ({ id: 1, x, y })),
    });
    const forward = () => page.evaluate(() => window.input.sample(performance.now()).forward);
    await touch("touchStart", [[180, 220]]);
    await page.waitForTimeout(1100);
    expect(await forward()).toBe(1);
    await touch("touchMove", [[195, 240]]);
    const defaults = await page.evaluate(() => window.defaults);
    expect(defaults.map((event) => event.type)).toEqual(["touchstart", "touchmove"]);
    expect(defaults.every((event) => event.cancelable && event.prevented)).toBe(true);
    const select = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const selection = new Event("selectstart", { bubbles: true, cancelable: true });
      const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      canvas.dispatchEvent(selection);
      canvas.dispatchEvent(menu);
      return { selection: selection.defaultPrevented, menu: menu.defaultPrevented };
    });
    expect(select).toEqual({ selection: true, menu: true });
    await expect(page.locator("canvas")).toHaveCSS("user-select", "none");
    await expect(page.locator(".compass")).toHaveCSS("user-select", "none");
    await expect(page.locator("#outside")).not.toHaveCSS("user-select", "none");
    await touch("touchEnd");
    expect(await forward()).toBe(0);

    for (const interruption of ["cancel", "blur", "hidden"]) {
      await touch("touchStart", [[180, 220]]);
      await page.waitForTimeout(300);
      expect(await forward()).toBe(1);
      if (interruption === "cancel") await touch("touchCancel");
      else {
        await page.evaluate((kind) => {
          if (kind === "blur") window.dispatchEvent(new Event("blur"));
          else {
            Object.defineProperty(document, "hidden", { configurable: true, value: true });
            document.dispatchEvent(new Event("visibilitychange"));
            delete document.hidden;
            document.dispatchEvent(new Event("visibilitychange"));
          }
        }, interruption);
        await touch("touchEnd");
      }
      expect(await forward()).toBe(0);
    }
    expect(await page.evaluate(() => window.selected)).toBe(0);
    await touch("touchStart", [[180, 220]]);
    await touch("touchEnd");
    expect(await page.evaluate(() => window.selected)).toBe(1);
    // Native defaults outside the active input lifecycle must stay available.
    for (const phase of ["inactive", "disposed"]) {
      await page.evaluate((phase) => {
        window.active = phase === "disposed";
        if (phase === "disposed") window.input.dispose();
        window.defaults = [];
      }, phase);
      await touch("touchStart", [[180, 220]]);
      await touch("touchEnd");
      expect(await page.evaluate(() => window.defaults[0].prevented)).toBe(false);
      expect(await forward()).toBe(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

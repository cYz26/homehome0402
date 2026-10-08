import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import config from "../playwright.config.mjs";

const browser = await chromium.launch({
  headless: config.use.headless,
  channel: config.use.channel,
  ...config.use.launchOptions,
});
try {
  const page = await browser.newPage();
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) throw Error("WebGL 2 unavailable in the verification browser");
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
      vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      nativePixelRatio: devicePixelRatio,
    };
  });
  const result = { browser: browser.version(), channel: config.use.channel, ...renderer };
  const at = process.argv.indexOf("--output");
  if (at >= 0) {
    const path = process.argv[at + 1];
    await fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(path, JSON.stringify(result, null, 2) + "\n");
  }
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}

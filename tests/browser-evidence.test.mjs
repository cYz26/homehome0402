import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const collector = fileURLToPath(new URL("../scripts/collect-browser-evidence.mjs", import.meta.url));
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "home402-evidence-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name, content) => {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  for (const name of [
    "dist/index.html", "dist/assets/app.js", "tests/browser.spec.mjs",
    "tests/section-render.spec.mjs", "tests/fixtures/section-probe.js",
    "tests/fixtures/section-probe.html", "playwright.config.mjs",
    "wrangler.jsonc", "worker/index.mjs", "tests/worker-auth.spec.mjs",
  ]) await write(name, name);
  await write("scripts/collect-browser-evidence.mjs", await fs.readFile(collector));
  await write("public/release.json", JSON.stringify({
    version: "fixture", assets: [{ role: "hd-model", sha256: "fixture-model" }],
  }));
  await write("node_modules/playwright-core/browsers.json", JSON.stringify({
    browsers: [{ name: "chromium", browserVersion: "fixture-version" }],
  }));
  const specs = ["first", "second"].map((id) => ({
    id, title: id, tests: [{ projectName: "", results: [{
      status: "passed", duration: 1, attachments: [],
    }] }],
  }));
  const report = {
    stats: { expected: 2, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [{ specs, suites: [] }],
  };
  await write("inventory.json", JSON.stringify(report));
  return {
    root, report, specs, write,
    async run() {
      await write("test-results/browser-report.json", JSON.stringify(report));
      return spawnSync(process.execPath, [collector, "--inventory", "inventory.json", "--output", "evidence"], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, HOME402_BUILD_ARTIFACT_ID: "build-123" },
      });
    },
  };
}

test("complete merged evidence retains both inline and extracted attachments", async (t) => {
  const f = await fixture(t);
  const imageBytes = Buffer.from("image attachment fixture");
  const metrics = JSON.stringify({ range: 2 });
  await f.write("extracted/metrics.json", metrics);
  f.specs[0].tests[0].results[0].attachments = [{
    name: "view", contentType: "image/png", body: imageBytes.toString("base64"),
  }];
  f.specs[1].tests[0].results[0].attachments = [{
    name: "metrics", contentType: "application/json",
    path: path.join(f.root, "extracted/metrics.json"),
  }];
  const result = await f.run();
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(await fs.readFile(path.join(f.root, "evidence/fixture/browser-verification.json")));
  assert.equal(receipt.tests.length, 2);
  assert.equal(receipt.images.length, 1);
  assert.equal(receipt.measurements.length, 1);
  assert.equal(receipt.buildArtifactId, "build-123");
  assert.match(receipt.inventorySha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(await fs.readFile(path.join(f.root, receipt.images[0].path)), imageBytes);
  assert.equal(await fs.readFile(path.join(f.root, receipt.measurements[0].path), "utf8"), metrics);
});

for (const [name, mutate] of [
  ["missing shard", (f) => { f.specs.pop(); f.report.stats.expected = 1; }],
  ["duplicate case", (f) => { f.specs.push(structuredClone(f.specs[0])); }],
  ["repeated execution", (f) => { f.specs[0].tests[0].results.push(structuredClone(f.specs[0].tests[0].results[0])); }],
]) {
  test(`evidence rejects ${name} even when reported results passed`, async (t) => {
    const f = await fixture(t);
    mutate(f);
    const result = await f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /complete inventory exactly once/);
    await assert.rejects(fs.access(path.join(f.root, "evidence/fixture/browser-verification.json")));
  });
}

test("evidence rejects a failing shard", async (t) => {
  const f = await fixture(t);
  f.report.stats.unexpected = 1;
  f.specs[0].tests[0].results[0].status = "failed";
  const result = await f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /completed passing browser run/);
});

test("evidence rejects missing attachment files", async (t) => {
  const f = await fixture(t);
  f.specs[0].tests[0].results[0].attachments = [{
    name: "lost-image", contentType: "image/png", path: "does-not-exist.png",
  }];
  const result = await f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  await assert.rejects(fs.access(path.join(f.root, "evidence/fixture/browser-verification.json")));
});

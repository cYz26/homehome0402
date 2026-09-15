import fs from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await fs.readFile("public/release.json"),
  manifest = JSON.parse(manifestBytes);
const reportBytes = await fs.readFile("test-results/browser-report.json"),
  report = JSON.parse(reportBytes);
if (
  report.stats.unexpected ||
  report.stats.skipped ||
  report.stats.flaky ||
  !report.stats.expected
)
  throw Error("Collect evidence only from a completed passing browser run.");
const at = process.argv.indexOf("--output"),
  root = at >= 0 ? process.argv[at + 1] : "docs/evidence";
if (!root) throw Error("--output requires a directory");
const directory = path.join(root, manifest.version);
await fs.mkdir(directory, { recursive: true });
const tests = [],
  images = [],
  measurements = [];
function* specs(suites) {
  for (const suite of suites) {
    yield* suite.specs;
    yield* specs(suite.suites ?? []);
  }
}
for (const spec of specs(report.suites))
  for (const test of spec.tests)
    for (const result of test.results) {
      tests.push({
        name: spec.title,
        status: result.status,
        durationMs: result.duration,
      });
      for (const attachment of result.attachments) {
        if (attachment.contentType === "application/json" && attachment.body) {
          const target = path.join(
            directory,
            attachment.name.replace(/[^a-z0-9-]/gi, "_") + ".json",
          );
          const bytes = Buffer.from(attachment.body, "base64");
          await fs.writeFile(target, bytes);
          measurements.push({ path: target, sha256: hash(bytes) });
          continue;
        }
        if (attachment.contentType !== "image/png" || !attachment.body)
          continue;
        const filename = attachment.name.replace(/[^a-z0-9-]/gi, "_") + ".png",
          target = path.join(directory, filename),
          bytes = Buffer.from(attachment.body, "base64");
        await fs.writeFile(target, bytes);
        images.push({ path: target, sha256: hash(bytes) });
      }
    }
if (tests.some((t) => t.status !== "passed"))
  throw Error("The report contains an incomplete test.");
const build = {};
for (const file of await fs.readdir("dist/assets"))
  build[`dist/assets/${file}`] = hash(await fs.readFile(`dist/assets/${file}`));
build["dist/index.html"] = hash(await fs.readFile("dist/index.html"));
const browsers = JSON.parse(
  await fs.readFile("node_modules/playwright-core/browsers.json"),
);
const receipt = {
  version: manifest.version,
  executedAt: report.stats.startTime,
  browser: `Playwright bundled Chromium ${browsers.browsers.find((b) => b.name === "chromium").browserVersion}`,
  host: {
    platform: os.platform(),
    architecture: os.arch(),
    release: os.release(),
  },
  responsiveViewports: [
    [1280, 900],
    [820, 1180],
    [390, 844],
  ],
  touch: "Chromium CDP simulation; no physical mobile device",
  manifestSha256: hash(manifestBytes),
  rawModelSha256: manifest.assets.find((a) => a.role === "hd-model").sha256,
  testSourceSha256: hash(await fs.readFile("tests/browser.spec.mjs")),
  renderingTestSources: Object.fromEntries(
    await Promise.all(
      [
        "tests/section-render.spec.mjs",
        "tests/fixtures/section-probe.js",
        "tests/fixtures/section-probe.html",
        "playwright.config.mjs",
      ].map(async (p) => [p, hash(await fs.readFile(p))]),
    ),
  ),
  collectorSha256: hash(
    await fs.readFile("scripts/collect-browser-evidence.mjs"),
  ),
  reportSha256: hash(reportBytes),
  tests,
  images,
  measurements,
  build,
  realPhonePerformance: "not-measured",
  visualAcceptance: "pending-user-review",
};
await fs.writeFile(
  path.join(directory, "browser-verification.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(
  `${manifest.version}: ${tests.length} passing browser flows and ${images.length} images bound to the release and build hashes.`,
);

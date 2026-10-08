import fs from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await fs.readFile("public/release.json"),
  manifest = JSON.parse(manifestBytes);
const reportAt = process.argv.indexOf("--report");
const reportBytes = await fs.readFile(reportAt >= 0 ? process.argv[reportAt + 1] : "test-results/browser-report.json"),
  report = JSON.parse(reportBytes);
if (
  report.errors?.length ||
  report.stats.unexpected ||
  report.stats.skipped ||
  report.stats.flaky ||
  !report.stats.expected
)
  throw Error("Collect evidence only from a completed passing browser run.");
const inventoryAt = process.argv.indexOf("--inventory");
let inventorySha256;
if (inventoryAt >= 0) {
  const inventoryPath = process.argv[inventoryAt + 1];
  if (!inventoryPath) throw Error("--inventory requires a file");
  const inventoryBytes = await fs.readFile(inventoryPath);
  const cases = (r) =>
    [...specs(r.suites)].flatMap((spec) =>
      spec.tests.map((t) => ({
        key: JSON.stringify([spec.id, t.projectName]),
        results: t.results,
      })),
    );
  const expected = cases(JSON.parse(inventoryBytes)).map((t) => t.key).sort();
  const actual = cases(report);
  if (
    !expected.length ||
    JSON.stringify(actual.map((t) => t.key).sort()) !== JSON.stringify(expected) ||
    actual.some((t) => t.results.length !== 1 || t.results[0].status !== "passed")
  )
    throw Error(
      "Browser results must cover the complete inventory exactly once, without retries.",
    );
  inventorySha256 = hash(inventoryBytes);
}
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
        if (!["application/json", "image/png"].includes(attachment.contentType))
          continue;
        // Merged blob reports can reference extracted files instead of inline
        // bodies. Missing evidence must fail collection instead of disappearing.
        const bytes =
          attachment.body !== undefined
            ? Buffer.from(attachment.body, "base64")
            : await fs.readFile(attachment.path);
        if (attachment.contentType === "application/json") {
          const target = path.join(
            directory,
            attachment.name.replace(/[^a-z0-9-]/gi, "_") + ".json",
          );
          await fs.writeFile(target, bytes);
          measurements.push({ path: target, sha256: hash(bytes) });
          continue;
        }
        const filename = attachment.name.replace(/[^a-z0-9-]/gi, "_") + ".png",
          target = path.join(directory, filename);
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
  modelPackages: manifest.assets.filter(a=>["model","hd-model"].includes(a.role))
    .map(({path,role,bytes,sha256})=>({path,role,bytes,sha256})),
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
  deploymentSources: Object.fromEntries(await Promise.all([
    "wrangler.jsonc", "worker/index.mjs", "tests/worker-auth.spec.mjs",
  ].map(async (p) => [p, hash(await fs.readFile(p))]))),
  reportSha256: hash(reportBytes),
  inventorySha256,
  buildArtifactId: process.env.HOME402_BUILD_ARTIFACT_ID,
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

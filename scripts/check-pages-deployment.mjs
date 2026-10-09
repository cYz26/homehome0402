import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";

const option = (name) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? undefined : process.argv[at + 1];
};
const base = new URL(option("--url") ?? process.env.HOME402_PAGES_URL);
assert.ok(base.protocol === "https:" || ["127.0.0.1", "localhost"].includes(base.hostname));
if (!base.pathname.endsWith("/")) base.pathname += "/";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await fs.readFile("dist/release.json");
const manifest = JSON.parse(manifestBytes);
const manifestSha256 = hash(manifestBytes);
async function request(file, options = {}) {
  const url = new URL(file === "index.html" ? "./" : file, base);
  assert.ok(url.href.startsWith(base.href), `Resource escapes the project URL: ${file}`);
  return fetch(url, {
    ...options, redirect: "manual", cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });
}

// Pages can report a successful deployment before every CDN node has refreshed.
let propagated = false;
for (let attempt = 0; attempt < 12; attempt++) {
  const response = await request("release.json");
  if (response.status === 200 && hash(Buffer.from(await response.arrayBuffer())) === manifestSha256) {
    propagated = true;
    break;
  }
  console.log(`Waiting for the checked Pages manifest (${attempt + 1}/12).`);
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
assert.ok(propagated, "Pages has not propagated the checked release manifest");

const assets = [];
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else assets.push(file.slice("dist/".length));
  }
}
await inspect("dist");
const checked = [];
for (const file of assets.sort()) {
  const response = await request(file);
  assert.equal(response.status, 200, `Public resource unavailable: ${file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), hash(await fs.readFile(`dist/${file}`)), `Remote build differs: ${file}`);
  checked.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
}
const ranges = [];
for (const file of [manifest, ...(manifest.additionalModels ?? [])].flatMap((p) => [p.model, p.rawModel])) {
  const response = await request(file, { headers: { Range: "bytes=0-65535" } });
  assert.equal(response.status, 206, `Range unsupported: ${file}`);
  const asset = manifest.assets.find((a) => a.path === file);
  assert.equal(response.headers.get("Content-Range"), `bytes 0-65535/${asset.bytes}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), hash((await fs.readFile(`dist/${file}`)).subarray(0, 65536)));
  ranges.push({ path: file, status: response.status, bytes: bytes.length });
}
const missing = await request("missing-model.glb");
assert.equal(missing.status, 404, "Missing assets must not return HTML success");
const receipt = {
  checkedAt: new Date().toISOString(), provider: "github-pages", url: base.href,
  version: manifest.version, applicationRevision: manifest.applicationRevision,
  manifestSha256, assets: checked, ranges, anonymousAccess: "public",
  missingAssetStatus: missing.status, realPhonePerformance: "not-measured",
  mainlandNetworkAccess: "not-measured",
};
const output = option("--output");
if (output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(receipt, null, 2) + "\n");
}
console.log(`${base.href}: ${checked.length} public files match SHA-256; ${ranges.length} model ranges verified.`);

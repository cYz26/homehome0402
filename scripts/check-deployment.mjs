import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";

const at = process.argv.indexOf("--url");
const base = new URL(at >= 0 ? process.argv[at + 1] : process.env.HOME402_WORKER_URL);
assert.ok(base.protocol === "https:" || ["127.0.0.1", "localhost"].includes(base.hostname));
const { SITE_PASSWORD_SHA256: passwordHash, SESSION_SECRET: signingSecret } = process.env;
assert.ok(/^[a-f0-9]{64}$/.test(passwordHash ?? "") && signingSecret?.length >= 32, "Missing verification secrets");
const value = `${Math.floor(Date.now() / 1000) + 3600}.${crypto.randomBytes(16).toString("hex")}`;
const signature = crypto.createHmac("sha256", signingSecret).update(`${base.origin}\n${passwordHash}\n${value}`).digest("hex");
const cookie = `__Host-home402_session=${value}.${signature}`;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function request(file, options = {}, authenticated = false) {
  return fetch(new URL(file === "index.html" ? "/" : `/${file}`, base), {
    ...options, redirect: "manual", signal: AbortSignal.timeout(60000),
    headers: { ...(authenticated ? { Cookie: cookie } : {}), ...options.headers },
  });
}
const login = await request("index.html", { headers: { Accept: "text/html" } });
assert.equal(login.status, 401, "Anonymous homepage must show the password gate");
assert.ok((await login.text()).includes('name="password"'));
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
  const anonymous = await request(file, { method: "HEAD" });
  assert.equal(anonymous.status, 401, `Public asset bypass: ${file}`);
  const response = await request(file, {}, true);
  assert.equal(response.status, 200, file);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store", file);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), hash(await fs.readFile(`dist/${file}`)), `Remote build differs: ${file}`);
  checked.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
}
const manifest = JSON.parse(await fs.readFile("dist/release.json", "utf8"));
const ranges = [];
for (const file of [manifest, ...(manifest.additionalModels ?? [])].flatMap(p=>[p.model,p.rawModel])) {
  const response = await request(file, { headers: { Range: "bytes=0-65535" } }, true);
  assert.equal(response.status, 206, `Range unsupported: ${file}`);
  const asset = manifest.assets.find((a) => a.path === file);
  assert.equal(response.headers.get("Content-Range"), `bytes 0-65535/${asset.bytes}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), hash((await fs.readFile(`dist/${file}`)).subarray(0, 65536)));
  const anonymous = await request(file, { headers: { Range: "bytes=0-65535" } });
  assert.equal(anonymous.status, 401, `Range bypass: ${file}`);
  ranges.push({ path: file, status: response.status, bytes: bytes.length });
}
const missing = await request("missing-model.glb", {}, true);
assert.equal(missing.status, 404, "Missing assets must not return HTML success");
const receipt = { checkedAt: new Date().toISOString(), url: base.origin, version: manifest.version, applicationRevision: manifest.applicationRevision, assets: checked, ranges, anonymousAccess: "blocked", realPhonePerformance: "not-measured" };
const outputAt = process.argv.indexOf("--output");
if (outputAt >= 0) {
  await fs.mkdir(path.dirname(process.argv[outputAt + 1]), { recursive: true });
  await fs.writeFile(process.argv[outputAt + 1], JSON.stringify(receipt, null, 2) + "\n");
}
console.log(`${base.origin}: ${checked.length} build files match SHA-256; anonymous access blocked; both model ranges verified.`);

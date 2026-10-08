import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import worker from "../worker/index.mjs";

// Workers' documented Web Crypto extension; Node uses its native equivalent.
crypto.subtle.timingSafeEqual ??= timingSafeEqual;
const origin = "https://home402.example";
const password = "unit-test-password-only";
const digest = (s) => createHash("sha256").update(s).digest("hex");
function environment(overrides = {}) {
  return {
    SITE_PASSWORD_SHA256: digest(password),
    SESSION_SECRET: "test-signing-secret-with-more-than-32-characters",
    LOGIN_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async () => new Response("asset", { headers: { "Content-Type": "application/octet-stream" } }) },
    ...overrides,
  };
}
function request(file = "/", options = {}) { return new Request(origin + file, options); }
async function login(env = environment(), submitted = password, next = "/") {
  return worker.fetch(request("/_auth/login", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: submitted, next }),
  }), env);
}
const cookie = (response) => response.headers.get("Set-Cookie").split(";")[0];

test("anonymous pages and direct assets never reach static storage", async () => {
  const env = environment({ ASSETS: { fetch() { throw Error("Asset leak"); } } });
  for (const file of ["/", "/release.json", "/releases/metric-v06/apartment-web.glb?sha=123", "/images/photo.webp", "/assets/main.js"])
    for (const method of ["GET", "HEAD"])
      assert.equal((await worker.fetch(request(file, { method, headers: { Range: "bytes=0-10" } }), env)).status, 401);
  const response = await worker.fetch(request("/?next=%22%3E%3Cscript%3E", { headers: { Accept: "text/html" } }), env);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.ok(response.headers.get("Content-Security-Policy").includes("form-action 'self'"));
  assert.ok((await response.text()).includes('name="password"'));
});
test("missing or invalid secrets fail closed", async () => {
  for (const overrides of [{ SITE_PASSWORD_SHA256: undefined }, { SITE_PASSWORD_SHA256: "bad" }, { SESSION_SECRET: "short" }])
    assert.equal((await worker.fetch(request("/release.json"), environment(overrides))).status, 503);
});
test("wrong password is rejected without issuing a session", async () => {
  const response = await login(environment(), "wrong");
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Set-Cookie"), null);
});
test("valid password issues a secure session and restores the complete view", async () => {
  const env = environment();
  const next = "/?detail=bath#view=%7B%22mode%22%3A%22top%22%7D";
  const response = await login(env, password, next);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), next);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=86400"])
    assert.ok(response.headers.get("Set-Cookie").includes(flag));
  assert.equal((await worker.fetch(request("/release.json", { headers: { Cookie: cookie(response) } }), env)).status, 200);
});
test("cross-origin or missing-origin login is rejected", async () => {
  for (const external of ["https://other.example", "null", ""]) {
    const response = await worker.fetch(request("/_auth/login", { method: "POST", headers: { Origin: external } }), environment());
    assert.equal(response.status, 403);
  }
});
test("login attempts are limited before password verification", async () => {
  const response = await login(environment({ LOGIN_LIMITER: { limit: async () => ({ success: false }) } }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
});
test("form size and unsupported content types are bounded", async () => {
  for (const options of [
    { headers: { "Content-Type": "application/json" }, body: "{}" },
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "a".repeat(9000) },
  ]) {
    const response = await worker.fetch(request("/_auth/login", { method: "POST", body: options.body, headers: { Origin: origin, ...options.headers } }), environment());
    assert.equal(response.status, 400);
  }
});
test("login redirects cannot escape the site", async () => {
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "/_auth/login", "javascript:alert(1)"])
    assert.equal((await login(environment(), password, next)).headers.get("Location"), "/");
});
test("forged, expired, cross-host and rotated sessions are rejected", async () => {
  const env = environment();
  const response = await login(env);
  const session = cookie(response);
  assert.equal((await worker.fetch(request("/", { headers: { Cookie: session.slice(0, -1) + "x" } }), env)).status, 401);
  for (const expiry of [Math.floor(Date.now() / 1000) - 1, Math.floor(Date.now() / 1000) + 90000]) {
    const value = `${expiry}.${"ab".repeat(16)}`;
    const signature = createHmac("sha256", env.SESSION_SECRET).update(`${origin}\n${env.SITE_PASSWORD_SHA256}\n${value}`).digest("hex");
    assert.equal((await worker.fetch(request("/", { headers: { Cookie: `__Host-home402_session=${value}.${signature}` } }), env)).status, 401);
  }
  assert.equal((await worker.fetch(new Request("https://other.example/", { headers: { Cookie: session } }), env)).status, 401);
  assert.equal((await worker.fetch(request("/", { headers: { Cookie: session } }), environment({ SITE_PASSWORD_SHA256: digest("changed-password") }))).status, 401);
});
test("authenticated requests stream ranges and retain ETag without public caching", async () => {
  let seen;
  const env = environment({ ASSETS: { fetch: async (r) => {
    seen = r;
    return new Response("part", { status: 206, headers: { "Content-Range": "bytes 0-3/100", ETag: '"asset-hash"', "Content-Length": "4" } });
  } } });
  const response = await worker.fetch(request("/model.glb?sha=123", { headers: { Cookie: cookie(await login(env)), Range: "bytes=0-3", "If-Range": '"asset-hash"' } }), env);
  assert.equal(response.status, 206);
  assert.equal(seen.headers.get("Range"), "bytes=0-3");
  assert.equal(seen.headers.get("If-Range"), '"asset-hash"');
  assert.equal(new URL(seen.url).search, "?sha=123");
  assert.equal(response.headers.get("Content-Range"), "bytes 0-3/100");
  assert.equal(response.headers.get("ETag"), '"asset-hash"');
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(await response.text(), "part");
});
test("legacy site path redirects after authentication", async () => {
  const env = environment();
  const response = await worker.fetch(request("/homehome402/?detail=master", { headers: { Cookie: cookie(await login(env)) } }), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/?detail=master");
});
test("an asset binding ignoring Range is sliced as a bounded stream", async () => {
  const env = environment({ ASSETS: { fetch: async () => new Response("0123456789", { headers: { "Content-Length": "10", ETag: '"asset"' } }) } });
  const session = cookie(await login(env));
  for (const [range, expected, contentRange] of [["bytes=2-5", "2345", "bytes 2-5/10"], ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=7-", "789", "bytes 7-9/10"]]) {
    const response = await worker.fetch(request("/model.glb", { headers: { Cookie: session, Range: range } }), env);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Content-Range"), contentRange);
    assert.equal(await response.text(), expected);
  }
  const invalid = await worker.fetch(request("/model.glb", { headers: { Cookie: session, Range: "bytes=99-" } }), env);
  assert.equal(invalid.status, 416);
  const changed = await worker.fetch(request("/model.glb", { headers: { Cookie: session, Range: "bytes=2-5", "If-Range": '"old-asset"' } }), env);
  assert.equal(changed.status, 200);
  assert.equal(await changed.text(), "0123456789");
});
test("logout clears the secure cookie and checks request origin", async () => {
  const response = await worker.fetch(request("/_auth/logout", { method: "POST", headers: { Origin: origin } }), environment());
  assert.equal(response.status, 303);
  assert.ok(response.headers.get("Set-Cookie").includes("Max-Age=0"));
  assert.equal((await worker.fetch(request("/_auth/logout", { method: "POST" }), environment())).status, 403);
});

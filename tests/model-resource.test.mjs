import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fetchModel } from "../src/model-resource.js";

const bytes = new Uint8Array(4 * 1024 ** 2 + 129);
for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
const asset = {
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
const url = "https://example.test/apartment-web.glb";
function partial(headers, corrupt = false) {
  const [, a, b] = headers.Range.match(/^bytes=(\d+)-(\d+)$/);
  const start = Number(a), end = Number(b);
  const body = bytes.slice(start, end + 1);
  if (corrupt) body[0] ^= 255;
  return new Response(body, {
    status: 206,
    headers: { "content-range": `bytes ${start}-${end}/${bytes.length}`, etag: '"model-v1"' },
  });
}

test("large model uses a small probe and four disjoint ranges with exact reconstruction", async (t) => {
  const calls = [], progress = [];
  t.mock.method(globalThis, "fetch", async (_, { headers }) => {
    calls.push(headers);
    return partial(headers);
  });
  const result = await fetchModel(url, asset, { onProgress: (n, total) => {
    assert.equal(total, bytes.length);
    progress.push(n);
  } });
  assert.deepEqual(new Uint8Array(result), bytes);
  assert.equal(calls.length, 5);
  assert.equal(calls[0].Range, "bytes=0-65535");
  assert.ok(calls.slice(1).every((h) => h["If-Range"] === '"model-v1"'));
  assert.equal(progress.at(-1), bytes.length);
  assert.deepEqual(progress, [...progress].sort((a, b) => a - b));
});

test("a server ignoring Range supplies one full response, without duplicate downloads", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(bytes);
  });
  assert.deepEqual(new Uint8Array(await fetchModel(url, asset)), bytes);
  assert.equal(calls, 1);
});

test("an invalid partial response falls back to a verified full response", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_, { headers }) => {
    calls++;
    return headers
      ? new Response(bytes.slice(0, 65536), { status: 206, headers: { "content-range": "bytes 1-65536/9999999" } })
      : new Response(bytes);
  });
  assert.deepEqual(new Uint8Array(await fetchModel(url, asset)), bytes);
  assert.equal(calls, 2);
});

test("mixed or corrupt model bytes never reach the parser", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, { headers }) => partial(headers, true));
  await assert.rejects(fetchModel(url, asset), /模型与发布版本不一致/);
});

test("a deployment changing ETag during ranges falls back to a full verified model", async (t) => {
  let wholeRequests = 0;
  t.mock.method(globalThis, "fetch", async (_, { headers }) => {
    if (!headers) { wholeRequests++; return new Response(bytes); }
    const response = partial(headers);
    if (headers["If-Range"]) response.headers.set("etag", '"model-v2"');
    return response;
  });
  assert.deepEqual(new Uint8Array(await fetchModel(url, asset)), bytes);
  assert.equal(wholeRequests, 1);
});

test("cache storage errors do not prevent model loading", async (t) => {
  const previous = globalThis.caches;
  globalThis.caches = { async open() { throw Error("Storage unavailable"); } };
  t.after(() => {
    if (previous === undefined) delete globalThis.caches;
    else globalThis.caches = previous;
  });
  t.mock.method(globalThis, "fetch", async (_, { headers }) => partial(headers));
  assert.deepEqual(new Uint8Array(await fetchModel(url, asset)), bytes);
});

test("cancelling parallel model transfers aborts every pending range without retry", async (t) => {
  const controller = new AbortController();
  let calls = 0, aborted = 0;
  t.mock.method(globalThis, "fetch", (_, { headers, signal }) => {
    calls++;
    if (calls === 1) return Promise.resolve(partial(headers));
    if (calls === 5) queueMicrotask(() => controller.abort());
    return new Promise((_, reject) => signal.addEventListener("abort", () => {
      aborted++;
      reject(signal.reason);
    }, { once: true }));
  });
  await assert.rejects(fetchModel(url, asset, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 5);
  assert.equal(aborted, 4);
});

test("HTTP failures remain bounded and do not start more model transfers", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("", { status: 503 }); });
  await assert.rejects(fetchModel(url, asset), /HTTP 503/);
  assert.equal(calls, 2);
});

test("verified persistent cache skips network; corrupt cache is replaced", async (t) => {
  const entries = new Map();
  const cache = {
    async match(key) { return entries.get(key)?.clone(); },
    async put(key, response) { entries.set(key, response.clone()); },
    async delete(key) { return entries.delete(typeof key === "string" ? key : key.url); },
    async keys() { return [...entries.keys()].map((url) => new Request(url)); },
  };
  const previous = globalThis.caches;
  globalThis.caches = { async open() { return cache; } };
  t.after(() => {
    if (previous === undefined) delete globalThis.caches;
    else globalThis.caches = previous;
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_, { headers }) => { calls++; return partial(headers); });
  await fetchModel(url, asset);
  await fetchModel(url, asset);
  assert.equal(calls, 5, "second load uses the verified model cache");
  const key = [...entries.keys()][0];
  entries.set(key, new Response("corrupt"));
  assert.deepEqual(new Uint8Array(await fetchModel(url, asset)), bytes);
  assert.equal(calls, 10);
});

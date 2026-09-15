import { test } from "node:test";
import assert from "node:assert/strict";
import { abortable, fetchResource } from "../src/resources.js";

test("cancelling a pending worker parse releases the caller immediately", async () => {
  const controller = new AbortController();
  let finish;
  const worker = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = abortable(worker, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  finish("late result");
});
test("resource request retries once and propagates cancellation without retrying", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? new Response("", { status: 503 })
      : Response.json({ version: "v06" });
  });
  assert.deepEqual(await fetchResource("https://example.test/data"), {
    version: "v06",
  });
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw controller.signal.reason;
  });
  await assert.rejects(
    fetchResource("https://example.test/data", { signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});

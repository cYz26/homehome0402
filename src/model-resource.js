import { abortable, fetchResource, readBuffer } from "./resources.js";

const CACHE = "home402-models-v1";
class RangeUnavailable extends Error {}

async function matches(bytes, asset) {
  if (bytes.byteLength !== asset.bytes) return false;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("") === asset.sha256;
}

// Small probe avoids downloading several full copies on servers ignoring Range.
// Four subsequent requests share the remaining bytes; hash verification also
// protects against a deployment changing the model between range responses.
async function download(url, size, signal, onProgress) {
  if (size < 4 * 1024 ** 2)
    return fetchResource(url, { signal, type: "buffer", onProgress });
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.throwIfAborted();
  signal?.addEventListener("abort", abort, { once: true });
  let etag;
  async function range(start, end, progress, probe = false) {
    for (let attempt = 0; attempt < 2; attempt++) {
      controller.signal.throwIfAborted();
      const response = await fetch(url, {
        signal: controller.signal,
        cache: attempt ? "reload" : "default",
        headers: {
          Range: `bytes=${start}-${end}`,
          ...(etag ? { "If-Range": etag } : {}),
        },
      });
      if (probe && response.status === 200)
        return { full: true, bytes: await readBuffer(response, onProgress, size) };
      if (response.status === 206) {
        const currentTag = response.headers.get("etag");
        if (response.headers.get("content-range") !== `bytes ${start}-${end}/${size}` ||
          (etag && currentTag !== etag)) {
          await response.body?.cancel();
          throw new RangeUnavailable();
        }
        if (probe && currentTag && !currentTag.startsWith("W/")) etag = currentTag;
        const bytes = await readBuffer(response, progress, end - start + 1);
        if (bytes.byteLength !== end - start + 1) throw new RangeUnavailable();
        return { bytes };
      }
      await response.body?.cancel();
      if (response.status === 200 || response.status === 416)
        throw new RangeUnavailable();
      if (attempt === 1) throw Error(`模型下载失败（HTTP ${response.status}）`);
    }
  }
  try {
    const probeSize = 64 * 1024;
    const first = await range(0, probeSize - 1, (n) => onProgress?.(n, size), true);
    if (first.full) return first.bytes;
    const received = [probeSize, 0, 0, 0, 0];
    const partSize = Math.ceil((size - probeSize) / 4);
    const result = new Uint8Array(size);
    result.set(new Uint8Array(first.bytes));
    await Promise.all(Array.from({ length: 4 }, async (_, index) => {
      const start = probeSize + index * partSize;
      const end = Math.min(size, start + partSize) - 1;
      const part = await range(start, end, (n) => {
        received[index + 1] = Math.max(received[index + 1], n);
        onProgress?.(received.reduce((sum, n) => sum + n, 0), size);
      });
      result.set(new Uint8Array(part.bytes), start);
    }));
    return result.buffer;
  } catch (error) {
    controller.abort();
    signal?.throwIfAborted();
    if (!(error instanceof RangeUnavailable)) throw error;
    return fetchResource(url, { signal, type: "buffer", onProgress });
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

export async function fetchModel(url, asset, { signal, onProgress } = {}) {
  signal?.throwIfAborted();
  if (!asset?.bytes || !/^[a-f0-9]{64}$/.test(asset.sha256))
    throw Error("模型缺少发布校验信息，请刷新页面后重试。");
  const key = new URL(url, globalThis.location?.href);
  key.searchParams.set("model-sha256", asset.sha256);
  let cache;
  try {
    cache = await globalThis.caches?.open(CACHE);
    const cached = await cache?.match(key.href);
    if (cached) {
      const bytes = await abortable(cached.arrayBuffer(), signal);
      if (await matches(bytes, asset)) {
        signal?.throwIfAborted();
        onProgress?.(asset.bytes, asset.bytes);
        return bytes;
      }
      await cache.delete(key.href);
    }
  } catch {
    // Storage can be disabled or full. Network loading remains available.
    signal?.throwIfAborted();
  }
  const bytes = await download(url, asset.bytes, signal, onProgress);
  signal?.throwIfAborted();
  if (!(await matches(bytes, asset)))
    throw Error("模型与发布版本不一致，请刷新页面后重试。");
  signal?.throwIfAborted();
  if (cache) {
    // Do not make first render wait for a persistent storage write. Keep one
    // verified version per model URL (standard and HD remain separate).
    void (async () => {
      await cache.put(key.href, new Response(bytes));
      for (const request of await cache.keys()) {
        const old = new URL(request.url);
        if (old.origin === key.origin && old.pathname === key.pathname && old.href !== key.href)
          await cache.delete(request);
      }
    })().catch(() => {});
  }
  return bytes;
}

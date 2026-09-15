// Stop waiting immediately on cancellation, including parsers whose worker API
// does not accept AbortSignal. The caller still owns disposal of late results.
export function abortable(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function fetchResource(
  url,
  { signal, type = "json", onProgress, attempts = 2 } = {},
) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal,
        cache: attempt ? "reload" : "default",
      });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      if (type === "json") return await response.json();
      if (type === "text") return await response.text();
      const length = Number(response.headers.get("content-length"));
      if (!response.body || !onProgress) return await response.arrayBuffer();
      const reader = response.body.getReader(),
        chunks = [];
      let loaded = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onProgress(loaded, length);
      }
      const result = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result.buffer;
    } catch (error) {
      if (error.name === "AbortError" || signal?.aborted) throw error;
      last = error;
    }
  }
  throw Error(
    `资源读取失败：${new URL(url, location.href).pathname}（${last?.message}）`,
  );
}

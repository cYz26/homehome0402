import release from "../public/release.json" with { type: "json" };

const encoder = new TextEncoder();
const cookieName = "__Host-home402_session";
const sessionSeconds = 86400;
const hex = (bytes) => Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
const unhex = (value) => Uint8Array.from(value.match(/../g) ?? [], (v) => parseInt(v, 16));
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function protect(response) {
  const headers = new Headers(response.headers);
  // The asset binding keeps its edge cache; clients/shared proxies must always
  // pass through authentication. Never buffer the model response here.
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.append("Vary", "Cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function safeNext(value, origin) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const next = new URL(value, origin);
    if (next.origin !== origin || next.pathname.startsWith("/_auth/")) return "/";
    return next.pathname + next.search + next.hash;
  } catch { return "/"; }
}

function loginPage(next = "/", message = "", status = 401) {
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Home 402 · 访问空间档案</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#f3f0e9;color:#343c38;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}
main{width:min(100%,440px);padding:clamp(28px,7vw,48px);background:#faf9f5;border:1px solid #d9dcd2;border-radius:8px;box-shadow:0 12px 48px #343c3809}
.eyebrow{letter-spacing:.2em;font-size:12px;color:#67776e}h1{font-weight:500;font-size:28px;line-height:1.4;margin:20px 0 12px}p{color:#69716b;font-size:14px;line-height:1.8}label{display:block;font-size:14px;margin:28px 0 10px}input,button{font:inherit;width:100%;padding:14px 16px;border-radius:4px}input{border:1px solid #b5bfb5;background:#fff;color:#343c38}input:focus{outline:2px solid #718a78;outline-offset:2px}button{margin-top:16px;border:0;background:#455e4d;color:#fff;cursor:pointer}button:hover{background:#334b3a}.error{color:#9a4338;min-height:25px;margin:12px 0 0}.foot{font-size:12px;margin:24px 0 0}
</style></head><body><main><div class="eyebrow">HOME 402</div><h1>家的空间档案</h1><p>这是一份私密的房屋设计档案。<br>请输入分享密码，进入查看。</p>
<form action="/_auth/login" method="post"><input type="hidden" name="next" value="${escapeHtml(next)}"><label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">进入空间</button><p class="error" role="alert">${escapeHtml(message)}</p></form><p class="foot">登录有效期为 24 小时，请妥善保管分享密码。</p></main>
<script nonce="${nonce}">const next=document.querySelector('[name="next"]');if(location.hash&&!next.value.includes('#'))next.value+=location.hash;</script></body></html>`;
  return protect(new Response(html, { status, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  } }));
}

async function signingKey(env) {
  return crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const sessionMessage = (value, env, origin) => encoder.encode(`${origin}\n${env.SITE_PASSWORD_SHA256}\n${value}`);
async function validSession(request, env, origin) {
  const token = (request.headers.get("Cookie") ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expiry, nonce, signature] = token.split(".");
  const now = Math.floor(Date.now() / 1000);
  if (+expiry <= now || +expiry > now + sessionSeconds) return false;
  return crypto.subtle.verify("HMAC", await signingKey(env), unhex(signature), sessionMessage(`${expiry}.${nonce}`, env, origin));
}

async function readForm(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded")) return null;
  if (Number(request.headers.get("Content-Length")) > 8192) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}

async function fetchAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  const range = request.headers.get("Range");
  // Some Static Assets runtimes return a full 200 from the binding even for a
  // Range request. Slice that stream without buffering a complete GLB.
  if (request.method !== "GET" || !range || response.status !== 200 || response.headers.has("Content-Encoding")) return response;
  // The binding can omit Content-Length; the checked release is also bundled
  // with this Worker, so its model sizes belong to this same deployment.
  const size = Number(response.headers.get("Content-Length") ?? release.assets.find((asset) => `/${asset.path}` === new URL(request.url).pathname)?.bytes);
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size <= 0) return response;
  const ifRange = request.headers.get("If-Range");
  if (ifRange && (ifRange.startsWith("W/") || ifRange !== response.headers.get("ETag"))) return response;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
    await response.body?.cancel();
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  if (!response.body) return response;
  const reader = response.body.getReader();
  let offset = 0;
  const body = new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        const chunkStart = offset;
        offset += value.byteLength;
        const from = Math.max(0, start - chunkStart);
        const to = Math.min(value.byteLength, end + 1 - chunkStart);
        if (to > from) controller.enqueue(value.subarray(from, to));
        if (offset > end) { controller.close(); await reader.cancel(); return; }
        if (to > from) return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(body, { status: 206, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Initial deployments and missing secrets stay closed, including assets.
    if (!/^[a-f0-9]{64}$/.test(env.SITE_PASSWORD_SHA256 ?? "") || (env.SESSION_SECRET?.length ?? 0) < 32)
      return protect(new Response("网站访问尚未配置，请稍后重试。", { status: 503 }));
    if (url.pathname === "/_auth/login" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin)
        return protect(new Response("无效的登录来源。", { status: 403 }));
      // A shared-password site has no account identifier; limit by visitor IP.
      // Counters are per Cloudflare location, not a global exact quota.
      const { success } = await env.LOGIN_LIMITER.limit({ key: `home402:${request.headers.get("CF-Connecting-IP") ?? "local"}` });
      if (!success) {
        const response = loginPage("/", "尝试次数较多，请一分钟后重试。", 429);
        response.headers.set("Retry-After", "60");
        return response;
      }
      const form = await readForm(request);
      const next = safeNext(form?.get("next"), url.origin);
      const password = form?.get("password");
      if (!password || password.length > 256)
        return loginPage(next, "请输入有效的访问密码。", 400);
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
      if (!crypto.subtle.timingSafeEqual(digest, unhex(env.SITE_PASSWORD_SHA256)))
        return loginPage(next, "密码不正确，请重新输入。", 401);
      const value = `${Math.floor(Date.now() / 1000) + sessionSeconds}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
      const signature = hex(await crypto.subtle.sign("HMAC", await signingKey(env), sessionMessage(value, env, url.origin)));
      return protect(new Response(null, { status: 303, headers: {
        Location: next,
        "Set-Cookie": `${cookieName}=${value}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionSeconds}`,
      } }));
    }
    if (url.pathname === "/_auth/logout" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) return protect(new Response("无效的请求来源。", { status: 403 }));
      return protect(new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } }));
    }
    if (!(await validSession(request, env, url.origin))) {
      if (request.method === "GET" && (request.headers.get("Sec-Fetch-Dest") === "document" || request.headers.get("Accept")?.includes("text/html")))
        return loginPage(safeNext(url.pathname + url.search, url.origin));
      return protect(new Response("请输入访问密码。", { status: 401 }));
    }
    if (!["GET", "HEAD"].includes(request.method)) return protect(new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } }));
    // Preserve old share paths on this hostname, including the browser fragment.
    if (url.pathname === "/homehome402" || url.pathname === "/homehome402/")
      return protect(new Response(null, { status: 302, headers: { Location: `/${url.search}` } }));
    return protect(await fetchAsset(request, env));
  },
};

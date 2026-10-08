import { spawnSync } from "node:child_process";

for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SITE_PASSWORD_SHA256", "SESSION_SECRET"])
  if (!process.env[name]) throw Error(`Missing deployment secret: ${name}`);
if (!/^[a-f0-9]{64}$/.test(process.env.SITE_PASSWORD_SHA256) || process.env.SESSION_SECRET.length < 32)
  throw Error("Invalid site access secrets");
function wrangler(args, input) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { input, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error || result.status !== 0) throw Error(`Wrangler ${args[0]} failed`);
}
// A new Worker is closed (503) until these secrets are installed. Existing
// deployments retain their gate throughout both steps; no public asset window.
wrangler(["deploy"]);
wrangler(["secret", "bulk"], JSON.stringify({
  SITE_PASSWORD_SHA256: process.env.SITE_PASSWORD_SHA256,
  SESSION_SECRET: process.env.SESSION_SECRET,
}));

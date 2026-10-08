import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

// A separate config directory prevents reading the user's production .dev.vars.
const directory = path.resolve(".asset-work/tmp/worker-test");
await fs.mkdir(directory, { recursive: true });
const config = JSON.parse(await fs.readFile("wrangler.jsonc", "utf8"));
await fs.writeFile(`${directory}/wrangler.jsonc`, JSON.stringify({
  ...config, main: path.resolve(config.main),
  assets: { ...config.assets, directory: path.resolve(config.assets.directory) },
}, null, 2));
await fs.writeFile(`${directory}/.dev.vars`, [
  `SITE_PASSWORD_SHA256=${crypto.createHash("sha256").update("home402-browser-test-only").digest("hex")}`,
  "SESSION_SECRET=home402-test-signing-key-never-use-in-production",
].join("\n"), { mode: 0o600 });
const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--config", `${directory}/wrangler.jsonc`, "--ip", "127.0.0.1", "--port", "4175"], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });

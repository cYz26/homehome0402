import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const at = process.argv.indexOf("--password-file");
const passwordPath = at >= 0 ? process.argv[at + 1] : path.join(os.homedir(), ".config/home402/site-password.txt");
if (!passwordPath) throw Error("--password-file requires a path");
// Remove only the editor's final newline; spaces are part of the password.
const password = (await fs.readFile(passwordPath, "utf8")).replace(/\r?\n$/, "");
if (!password.length || password.length > 256 || /[\r\n]/.test(password))
  throw Error("The password file must contain one non-empty line, up to 256 characters.");
await fs.chmod(passwordPath, 0o600);
const statePath = path.join(os.homedir(), ".config/home402/worker-secrets.json");
let existing = {};
try { existing = JSON.parse(await fs.readFile(statePath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const secrets = {
  SITE_PASSWORD_SHA256: crypto.createHash("sha256").update(password).digest("hex"),
  SESSION_SECRET: existing.SESSION_SECRET ?? crypto.randomBytes(32).toString("hex"),
};
await fs.mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
await fs.writeFile(statePath, JSON.stringify(secrets, null, 2) + "\n", { mode: 0o600 });
await fs.chmod(statePath, 0o600);
if (process.argv.includes("--local")) {
  await fs.writeFile(".dev.vars", Object.entries(secrets).map(([name, value]) => `${name}=${value}`).join("\n") + "\n", { mode: 0o600 });
  await fs.chmod(".dev.vars", 0o600);
  console.log("Local Worker secrets ready; values were not printed.");
} else if (process.argv.includes("--github")) {
  for (const [name, value] of Object.entries(secrets)) {
    const result = spawnSync("gh", ["secret", "set", name], { input: value, stdio: ["pipe", "inherit", "inherit"] });
    if (result.error || result.status !== 0) throw Error(`Unable to set GitHub secret ${name}`);
  }
  console.log("GitHub deployment secrets ready; values were not printed.");
} else {
  const result = spawnSync("node_modules/.bin/wrangler", ["secret", "bulk"], { input: JSON.stringify(secrets), stdio: ["pipe", "inherit", "inherit"] });
  if (result.error || result.status !== 0) throw Error("Unable to set Cloudflare Worker secrets");
}

import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const config = JSON.parse(await fs.readFile("wrangler.jsonc", "utf8"));
assert.equal(config.assets.run_worker_first, true, "Every asset must pass the password gate");
assert.equal(config.preview_urls, false, "Unnecessary preview URLs must stay disabled");
assert.equal(config.assets.directory, "./dist");
let count = 0, total = 0, largest = { path: "", bytes: 0 };
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else {
      assert.ok(!entry.isSymbolicLink(), `Unexpected deployment symlink: ${file}`);
      const { size } = await fs.stat(file);
      assert.ok(size <= 25 * 1024 ** 2, `Asset exceeds Workers 25 MiB limit: ${file}`);
      assert.ok(!/(?:^|\/)(?:\.dev\.vars|\.env|site-password|worker-secrets)/.test(file), `Private configuration in assets: ${file}`);
      count++; total += size;
      if (size > largest.bytes) largest = { path: file, bytes: size };
    }
  }
}
await inspect("dist");
assert.ok(count > 0 && count <= 20000, "Asset count exceeds the Workers Free limit");
console.log(JSON.stringify({ passed: true, files: count, totalBytes: total, largest }, null, 2));

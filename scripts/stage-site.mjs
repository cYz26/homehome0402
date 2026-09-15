import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const manifest = JSON.parse(await fs.readFile("public/release.json"));
const output = ".asset-work/site-public";
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const asset of manifest.assets) {
  if (asset.path.includes("..") || path.isAbsolute(asset.path))
    throw Error("Invalid resource path");
  const bytes = await fs.readFile(asset.source ?? `public/${asset.path}`);
  if (
    bytes.length !== asset.bytes ||
    crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  )
    throw Error(`Stale release manifest: ${asset.path}`);
  const destination = path.join(output, asset.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
}
await fs.copyFile("public/release.json", `${output}/release.json`);
console.log(
  `Staged ${manifest.assets.length} versioned resources; historical GLBs remain archived outside the site.`,
);

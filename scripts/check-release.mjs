import fs from "node:fs/promises";
import assert from "node:assert/strict";
import viteConfig from "../vite.config.js";
import crypto from "node:crypto";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { getBounds } from "@gltf-transform/functions";
import { modelPackages } from "./model-packages.mjs";
import { polygonArea } from "../src/spatial.js";
const json = async (p) => JSON.parse(await fs.readFile(p));
const spec = await json("model/apartment.json"),
  manifest = await json("public/release.json"),
  data = await json(`public/${manifest.architecture}`),
  navigation = await json(`public/${manifest.navigation}`),
  validation = await json("model/validation.json"),
  baseline = await json("model/baseline-v05/validation.json");
const checks = [];
const check = (name, fn) => {
  fn();
  checks.push({ name, pass: true });
};
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
check("spec, data, navigation and manifest are one version", () => {
  assert.equal(spec.version, manifest.version);
  assert.equal(data.version, spec.version);
  assert.equal(navigation.version, spec.version);
  assert.equal(validation.version, spec.version);
});
for (const [p, digest] of Object.entries(manifest.sources))
  assert.equal(hash(await fs.readFile(p)), digest, `Stale derived source ${p}`);
for (const a of manifest.assets) {
  const b = await fs.readFile(a.source ?? `public/${a.path}`);
  assert.equal(hash(b), a.sha256, a.path);
  assert.equal(b.length, a.bytes, a.path);
}
checks.push({
  name: "Every source and published resource matches its SHA-256",
  pass: true,
});
for (const a of manifest.assets.filter((a) => a.path.endsWith(".webp"))) {
  const metadata = await sharp(`public/${a.path}`).metadata();
  assert.ok(
    !metadata.exif && !metadata.xmp && !metadata.iptc,
    `Unexpected image metadata: ${a.path}`,
  );
}
checks.push({
  name: "Published images contain no EXIF, XMP or IPTC metadata",
  pass: true,
});
check(
  "All source parts have unique semantic owners and all IDs resolve",
  () => {
    assert.equal(
      new Set(spec.entities.map((e) => e.id)).size,
      spec.entities.length,
    );
    const all = spec.entities.flatMap((e) => e.sourceNodes);
    assert.equal(all.length, validation.source_objects);
    assert.equal(new Set(all).size, all.length);
    assert.deepEqual(new Set(all), new Set(Object.keys(validation.objects)));
    for (const e of spec.entities)
      for (const r of e.roomIds)
        assert.ok(
          spec.rooms.some((room) => room.id === r),
          `${e.id}:${r}`,
        );
  },
);
check("all geometry outside recorded revisions remains identical to v05", () => {
  const exceptions = new Set(spec.revisions.flatMap((r) => r.entityIds));
  for (const [name, current] of Object.entries(validation.objects)) {
    if (exceptions.has(current.entityId)) continue;
    const old = baseline.objects[name];
    assert.ok(old, name);
    assert.equal(current.triangles, old.triangles, name);
    for (let side = 0; side < 2; side++)
      for (let axis = 0; axis < 3; axis++)
        assert.ok(
          Math.abs(current.bounds[side][axis] - old.bounds[side][axis]) <
            0.0001,
          name,
        );
  }
});
if (spec.furnishings?.length) {
  const previous = await json("model/baseline-v06/validation.json");
  check("Every v06 architectural part outside the recorded photo doorway remains unchanged", () => {
    const changed=new Set(spec.revisions.filter(r=>r.id==='living-v06-photo-tv-wall').flatMap(r=>r.nodeNames??[]));
    const allowed = new Set(spec.studyDecision ? [
      ...spec.entities.find(e=>e.windowId==='X_north').sourceNodes,
      "wall_north_3_0_lower",
    ] : []);
    for (const [name, old] of Object.entries(previous.objects)) {
      if(changed.has(name))continue;
      const current = validation.objects[name];
      assert.ok(current, name);
      assert.equal(current.entityId, old.entityId, name);
      assert.equal(current.triangles, old.triangles, name);
      if(allowed.has(name)) continue;
      for (let side=0; side<2; side++) for (let axis=0; axis<3; axis++)
        assert.ok(Math.abs(current.bounds[side][axis]-old.bounds[side][axis])<0.0001, name);
    }
  });
}
check(
  "door hinge sides and fully open directions follow the redlined plan",
  () => {
    const doors = Object.fromEntries(spec.doors.map((d) => [d.id, d]));
    assert.deepEqual(doors.master.hinge, [3.5, 7.55]);
    assert.deepEqual(doors.southeast.hinge, [7.5, 7.62]);
    assert.equal(doors.master.openAngle, Math.PI);
    assert.equal(doors.southeast.openAngle, 0);
    assert.equal(doors.northwest.openAngle, -Math.PI / 2);
    assert.equal(doors.entry.openAngle, 0);
    for (const [name, d] of Object.entries(doors)) {
      const leaf = validation.objects[`door_${name}_lower`];
      assert.ok(leaf, `leaf ${name}`);
      const dx = leaf.bounds[1][0] - leaf.bounds[0][0],
        dy = leaf.bounds[1][1] - leaf.bounds[0][1];
      assert.ok(Math.min(dx, dy) < 0.05, `door not parallel to wall ${name}`);
    }
  },
);
check("space areas derive from polygons after subtracting walls", () => {
  for (const r of data.rooms) {
    const area = r.polygons.reduce(
      (a, p) =>
        a +
        polygonArea(p[0]) -
        p.slice(1).reduce((s, h) => s + polygonArea(h), 0),
      0,
    );
    assert.ok(Math.abs(area - r.area) < 0.0051);
    assert.ok(r.area < polygonArea(r.polygon));
    assert.equal(r.areaBasis, "model-estimate");
  }
});
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const packages = modelPackages(spec);
const pairs = await Promise.all(packages.map(async p=>({pack:p,packed:await io.read(`public/releases/${spec.version}/${p.webFile}`),raw:await io.read(`asset_exchange/${p.assetStem}.glb`)})));
const packed = pairs[0].packed;
check('All model packages bind the same source, preserve ownership and retain the original sofa PBR',()=>{
  const seen = new Set();
  for(const {pack,packed} of pairs) {
    const ids = new Set(packed.getRoot().listNodes().map(n=>n.getExtras().entityId).filter(Boolean));
    for(const id of ids) {assert.ok(!seen.has(id),id);seen.add(id);}
    const raw = validation.model_packages.find(p=>p.id===pack.id);
    const hd = manifest.assets.find(a=>a.path.endsWith('/'+pack.hdFile));
    assert.equal(raw.sha256,hd.sha256);
    for(const n of packed.getRoot().listNodes().filter(n=>n.getExtras().entityId))
      assert.equal(n.getExtras().modelVersion,spec.version);
    if(pack.id==='living-sofa') {
      assert.deepEqual([...ids],['living-sofa']);
      assert.ok(packed.getRoot().listMaterials().some(m=>m.getName()==='Tripo_sofa_original_PBR' && m.getNormalTexture()));
      assert.ok(packed.getRoot().listTextures().every(t=>t.getSize().every(n=>n===4096)));
    }
  }
  assert.deepEqual(seen,new Set(spec.entities.map(e=>e.id)));
});
check(
  "web textures preserve source resolution with only KTX block alignment",
  () => {
    for (const pair of pairs) for (const source of pair.raw.getRoot().listTextures()) {
      const texture = pair.packed
        .getRoot()
        .listTextures()
        .find((t) => t.getName() === source.getName());
      assert.ok(texture, source.getName());
      // UASTC aligns the original 1254-pixel images to a 1256-pixel block boundary.
      assert.deepEqual(
        texture.getSize(),
        texture.getMimeType() === "image/ktx2" ? source.getSize().map((n) => Math.ceil(n / 4) * 4) : source.getSize(),
        source.getName(),
      );
    }
  },
);
check(
  "KTX2 and Meshopt are present and all component bounds survive compression",
  () => {
    const ext = packed
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName);
    assert.ok(ext.includes("KHR_texture_basisu"));
    assert.ok(ext.includes("EXT_meshopt_compression"));
    assert.ok(
      packed.getRoot().listTextures().every((t) => t.getMimeType() === "image/ktx2"),
    );
    for(const pair of pairs) assert.ok(pair.packed.getRoot().listExtensionsUsed().some(e=>e.extensionName === "EXT_meshopt_compression"));
    for (const e of data.entities) {
      const nodes = pairs.flatMap(p=>p.packed.getRoot().listNodes())
        .filter((n) => n.getMesh() && n.getExtras().entityId === e.id);
      assert.ok(nodes.length, e.id);
      const b = nodes.map(getBounds),
        min = [0, 1, 2].map((i) => Math.min(...b.map((b) => b.min[i]))),
        max = [0, 1, 2].map((i) => Math.max(...b.map((b) => b.max[i])));
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(min[i] - e.min[i]) < 0.001, `${e.id} min`);
        assert.ok(Math.abs(max[i] - e.max[i]) < 0.001, `${e.id} max`);
      }
    }
  },
);
const html = await fs.readFile("dist/index.html", "utf8");
check("Static homepage images, drawing and version labels bind the current release", () => {
  assert.ok(!/__RELEASE_PREFIX__|__MODEL_(?:SHORT_)?VERSION__/.test(html));
  assert.ok(html.includes(manifest.version));
  for (const match of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const source of match[1].split(",")) {
      const url=source.trim().split(/\s+/)[0];
      if (!url.includes("/releases/")) continue;
      assert.ok(url.startsWith(viteConfig.base), `Homepage resource escapes the site base: ${url}`);
      const path=url.slice(viteConfig.base.length);
      assert.ok(manifest.assets.some(a => a.path === path), `Homepage resource is stale: ${url}`);
    }
  }
});
const statics = await fs.readdir("dist/assets");
let jsBytes = 0,
  initialBytes = Buffer.byteLength(html);
for (const f of statics) {
  const bytes = (await fs.stat(`dist/assets/${f}`)).size;
  if (f.endsWith(".js")) jsBytes += bytes;
  if (f.startsWith("index-")) initialBytes += bytes;
}
initialBytes +=
  manifest.assets
    .filter((a) => a.role === "properties" || a.role === "drawing")
    .reduce((s, a) => s + a.bytes, 0) +
  (await fs.stat("public/release.json")).size +
  manifest.assets.find((a) => a.path.endsWith("hero-1600.webp")).bytes;
const firstViewportCoreBytes = initialBytes;
// Browsers may prefetch native lazy images beyond the fold. Budget every image
// embedded in the document, including the model placeholder, as an upper bound.
const documentImageIds = [
  "living",
  "kitchen",
  "master",
  "masterbath",
  "photo-hall",
  "photo-vanity",
  "photo-fridge",
];
const documentImages = new Set(
  documentImageIds.map((id) => manifest.images.find((i) => i.id === id).path),
);
initialBytes += manifest.assets
  .filter(
    (a) => documentImages.has(a.path) || a.path.endsWith("hero-1000.webp"),
  )
  .reduce((s, a) => s + a.bytes, 0);
const interactiveBytes =
  jsBytes +
  manifest.assets
    .filter((a) =>
      ["model", "properties", "navigation", "decoder"].includes(a.role),
    )
    .reduce((s, a) => s + a.bytes, 0);
check(
  "first-screen, web model and interactive resources fit the versioned visual-first budgets",
  () => {
    assert.ok(initialBytes <= manifest.budgets.firstScreenBytes, initialBytes);
    assert.ok(
      interactiveBytes <= manifest.budgets.interactive3DBytes,
      interactiveBytes,
    );
    assert.ok(manifest.assets.filter(a => a.role === "model").reduce((n,a)=>n+a.bytes,0) <= manifest.budgets.webModelBytes);
  },
);
check("Three.js is not preloaded by the initial HTML", () => {
  assert.ok(!/modulepreload[^>]+three/.test(html));
});
const allFiles = async function* (dir, prefix = "") {
  for (const f of await fs.readdir(dir, { withFileTypes: true })) {
    const p = prefix + f.name;
    if (f.isDirectory()) yield* allFiles(`${dir}/${f.name}`, p + "/");
    else yield p;
  }
};
const published = new Set(manifest.assets.map((a) => a.path));
published.add("release.json");
published.add("index.html");
for await (const p of allFiles("dist")) {
  if (p.startsWith("assets/")) continue;
  assert.ok(published.has(p), `Unexpected published file ${p}`);
}
checks.push({
  name: "Build contains only current selected resources and application code",
  pass: true,
});
const svg = await fs.readFile(`public/${manifest.floorplan}`, "utf8");
check(
  "SVG includes rooms, entities, doors, north and metre scale without invalid coordinates",
  () => {
    assert.ok(!/NaN|undefined/.test(svg));
    for (const r of data.rooms)
      assert.ok(svg.includes(`data-room-id="${r.id}"`));
    assert.ok(svg.includes('data-entity-id="door_master"'));
    assert.ok(svg.includes(">N<"));
    assert.ok(svg.includes("2 m"));
  },
);
const result = {
  version: spec.version,
  checks,
  passed: checks.length,
  initialBytes,
  firstViewportCoreBytes,
  interactiveBytes,
  webGLBBytes: manifest.assets.filter(a=>a.role === "model").reduce((n,a)=>n+a.bytes,0),
  modelPackages: manifest.assets.filter(a=>["model","hd-model"].includes(a.role)),
  sourceSha256: validation.source_sha256,
  rawModelSha256: validation.glb_sha256,
};
await fs.writeFile(
  "model/release-checks.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));

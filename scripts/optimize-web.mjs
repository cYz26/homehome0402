import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { modelPackages, packageEntityIds } from "./model-packages.mjs";
const spec = JSON.parse(await fs.readFile("model/apartment.json"));
const budgets = JSON.parse(await fs.readFile("model/resource-budgets.json"));
if (budgets.version !== spec.version) throw Error("Resource budget and model versions differ");
const out = `public/releases/${spec.version}`;
await fs.mkdir(out, { recursive: true });
await fs.mkdir(".asset-work/tmp", { recursive: true });
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const allIds = new Set(), reports = [];
for (const pack of modelPackages(spec)) {
  const temp = `.asset-work/tmp/optimize-${spec.version}-${pack.id}`;
  await fs.mkdir(temp, { recursive: true });
  const doc = await io.read(`asset_exchange/${pack.assetStem}.glb`);
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.MATERIAL, PropertyType.TEXTURE] }),
    flatten(),
  );
  const scene = doc.getRoot().listScenes()[0],
    groups = new Map();
  // Merge only inside a logical component and visibility layer. Never lose query ownership.
  for (const node of [...doc.getRoot().listNodes()]) {
    if (!node.getMesh()) continue;
    const extras = node.getExtras(),
      part = node.getName() === "Master_double_mirror" ? "mirror" : "";
    const key = [extras.entityId, extras.layer, part].join(":");
    if (!groups.has(key)) {
      const group = doc.createNode(key).setExtras({ ...extras, part });
      scene.addChild(group);
      groups.set(key, group);
    }
    const matrix = node.getWorldMatrix();
    const parent = node.getParentNode();
    if (parent) parent.removeChild(node);
    else scene.removeChild(node);
    groups.get(key).addChild(node);
    node.setMatrix(matrix);
  }
  await doc.transform(
    join({ keepNamed: false, filter: (node) => !!node.getMesh() }),
  );
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const parent = node.getParentNode();
    if (parent?.getExtras().entityId) node.setExtras(parent.getExtras());
  }
  // KTX compression first; geometry encoding last prevents decode/re-encode quantization drift.
  await io.write(`${temp}/textures.glb`, doc);
  // Reuse the previously verified full-resolution image policy for large PBR packages.
  const preserveOriginal = budgets.originalImagePackages?.includes(pack.id) ?? false;
  let packed;
  if (preserveOriginal) packed = await io.read(`${temp}/textures.glb`);
  else {
    const ktx = process.env.KTX_BIN ?? path.resolve(".asset-work/tools/ktx/bin");
    const result = spawnSync(
      "node",
      [
        "node_modules/@gltf-transform/cli/bin/cli.js",
        "uastc",
        `${temp}/textures.glb`,
        `${temp}/basis.glb`,
        "--level",
        "4",
        "--rdo",
        "false",
        "--zstd",
        "18",
        "--jobs",
        "4",
      ],
      {
        stdio: "inherit",
        env: { ...process.env, PATH: `${ktx}${path.delimiter}${process.env.PATH}` },
      },
    );
    if (result.status !== 0)
      throw Error(
        "KTX2 encoding failed. Install official KTX-Software and set KTX_BIN to its bin directory.",
      );
    packed = await io.read(`${temp}/basis.glb`);
  }
  await packed.transform(
    meshopt({
      encoder: MeshoptEncoder,
      level: "high",
      quantizePosition: 16,
      quantizeNormal: 12,
      quantizeTexcoord: 16,
    }),
  );
  const destination = `${out}/${pack.webFile}`;
  await io.write(destination, packed);
  const ids = new Set(
    packed
      .getRoot()
      .listNodes()
      .map((n) => n.getExtras().entityId)
      .filter(Boolean),
  );
  const expected = packageEntityIds(spec, pack);
  if (ids.size !== expected.size || [...ids].some(id => !expected.has(id)))
    throw Error(`Semantic coverage lost in ${pack.id}`);
  let size = (await fs.stat(destination)).size;
  let textureCodec = preserveOriginal ? "Original image encoding at full resolution; Meshopt geometry" : "KTX2 UASTC level 4, RDO disabled";
  if (size > 25 * 1024 ** 2) {
    // Retain original full-resolution image encoding if UASTC cannot fit the
    // hosting file limit. Never resize or reduce the image/geometry quality.
    packed = await io.read(`${temp}/textures.glb`);
    await packed.transform(meshopt({encoder: MeshoptEncoder, level:"high", quantizePosition:16, quantizeNormal:12, quantizeTexcoord:16}));
    await io.write(destination, packed);
    size = (await fs.stat(destination)).size;
    textureCodec = "Original image encoding at full resolution; Meshopt geometry";
  }
  if (size > 25 * 1024 ** 2) throw Error(`Package exceeds Workers file limit: ${pack.id}`);
  for (const id of ids) {
    if (allIds.has(id)) throw Error(`Duplicate package owner ${id}`);
    allIds.add(id);
  }
  reports.push({id:pack.id, model:destination, bytes:size, textureCodec,
    entities:ids.size, meshes:packed.getRoot().listMeshes().length,
    textures:packed.getRoot().listTextures().map(t=>({name:t.getName(),mime:t.getMimeType(),size:t.getSize()}))});
}
if(allIds.size !== spec.entities.length) throw Error("Incomplete scene package coverage");
const size = reports.reduce((sum,p)=>sum+p.bytes,0);
if(size > budgets.webModelBytes) throw Error(`Aggregate web model exceeds budget: ${size}`);
await fs.writeFile(`${out}/model-packages.json`, JSON.stringify({version:spec.version,bytes:size,packages:reports},null,2)+"\n");
await fs.mkdir("public/decoders/basis", { recursive: true });
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"])
  await fs.copyFile(
    `node_modules/three/examples/jsm/libs/basis/${file}`,
    `public/decoders/basis/${file}`,
  );
await fs.copyFile(
  "node_modules/three/LICENSE",
  "public/decoders/THREE-LICENSE.txt",
);
console.log(JSON.stringify({version:spec.version,bytes:size,MiB:+(size/1024**2).toFixed(3),entities:allIds.size,packages:reports},null,2));

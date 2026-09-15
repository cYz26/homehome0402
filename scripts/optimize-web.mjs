import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, join, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
const spec = JSON.parse(await fs.readFile("model/apartment.json"));
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
const doc = await io.read(`asset_exchange/${spec.assetStem}.glb`);
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
await io.write(".asset-work/tmp/textures.glb", doc);
const ktx = process.env.KTX_BIN ?? path.resolve(".asset-work/tools/ktx/bin");
const result = spawnSync(
  "node",
  [
    "node_modules/@gltf-transform/cli/bin/cli.js",
    "uastc",
    ".asset-work/tmp/textures.glb",
    ".asset-work/tmp/basis.glb",
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
const packed = await io.read(".asset-work/tmp/basis.glb");
await packed.transform(
  meshopt({
    encoder: MeshoptEncoder,
    level: "high",
    quantizePosition: 16,
    quantizeNormal: 12,
    quantizeTexcoord: 16,
  }),
);
const destination = `${out}/apartment-web.glb`;
await io.write(destination, packed);
const ids = new Set(
  packed
    .getRoot()
    .listNodes()
    .map((n) => n.getExtras().entityId)
    .filter(Boolean),
);
if (ids.size !== spec.entities.length)
  throw Error(`Semantic coverage lost: ${ids.size}/${spec.entities.length}`);
const size = (await fs.stat(destination)).size;
if (size > 16 * 1024 ** 2) throw Error(`Web GLB over budget: ${size}`);
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
console.log(
  JSON.stringify({
    model: destination,
    bytes: size,
    MiB: +(size / 1024 ** 2).toFixed(3),
    entities: ids.size,
    meshes: packed.getRoot().listMeshes().length,
    textures: packed
      .getRoot()
      .listTextures()
      .map((t) => ({ name: t.getName(), mime: t.getMimeType() })),
  }),
);

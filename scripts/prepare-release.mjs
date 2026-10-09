import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import nodePath from "node:path";
import { modelPackages } from "./model-packages.mjs";
const spec = JSON.parse(await fs.readFile("model/apartment.json"));
const resourceBudgets = JSON.parse(await fs.readFile("model/resource-budgets.json"));
if (resourceBudgets.version !== spec.version) throw Error("Resource budget and model versions differ");
const designSelection = spec.furnitureDecision ? JSON.parse(await fs.readFile(spec.furnitureDecision)) : null;
const studySelection = spec.studyDecision ? JSON.parse(await fs.readFile(spec.studyDecision)) : null;
const designSelections = [designSelection, studySelection].filter(Boolean);
const designInputs = designSelections.flatMap(selection => [
  ...(selection.selected_previews ?? []).map(r => r.path ?? r.source),
  ...(selection.independent_references ?? []).map(r => r.path),
  ...(selection.table_revision?.source_files ?? []).map(r => r.path),
  selection.table_revision?.standalone_reference?.path,
  ...(selection.display_effects ?? []).map(r=>r.source),
  ...(selection.support_inputs ?? []).map(r=>r.path),
]).filter(Boolean);
const packages = modelPackages(spec);
const version = spec.version,
  prefix = `releases/${version}`,
  out = `public/${prefix}`;
await fs.mkdir(`${out}/images`, { recursive: true });
const assets = [],
  images = [];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const applicationRevision = "2026-10-09-living-study-integrated";
const deploymentSources = [
  "wrangler.jsonc", "worker/index.mjs", "scripts/deploy-worker.mjs",
  "scripts/worker-secrets.mjs", "scripts/check-worker.mjs",
  "scripts/check-deployment.mjs",
  ".github/workflows/pages.yml", "scripts/check-pages-deployment.mjs",
];

// Frontend-only work can reuse the already verified render/model assets. Reject
// changed design/build inputs rather than silently certifying stale derivatives.
if (process.argv.includes("--code-only")) {
  const manifest = JSON.parse(await fs.readFile("public/release.json"));
  const record = JSON.parse(await fs.readFile("docs/delivery-record.json"));
  if (manifest.version !== version || record.version !== version)
    throw Error("Rebuild changed design versions before preparing a release.");
  const codePaths = [
    "index.html", "vite.config.js", "package.json", "package-lock.json",
    "scripts/prepare-release.mjs",
    ...deploymentSources,
    ...(await fs.readdir("src")).filter((f) => /\.(js|css)$/.test(f)).map((f) => `src/${f}`),
  ];
  for (const [path, digest] of Object.entries(manifest.sources)) {
    if (codePaths.includes(path) || path.startsWith("src/")) continue;
    if (hash(await fs.readFile(path)) !== digest)
      throw Error(`Rebuild changed design/asset input: ${path}`);
  }
  for (const asset of manifest.assets) {
    const bytes = await fs.readFile(asset.source ?? `public/${asset.path}`);
    if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256)
      throw Error(`Published asset changed: ${asset.path}`);
  }
  const sources = Object.fromEntries(Object.entries(manifest.sources)
    .filter(([path]) => !path.startsWith("src/")));
  for (const path of codePaths) sources[path] = hash(await fs.readFile(path));
  const release = JSON.stringify({ ...manifest, applicationRevision, sources }, null, 2);
  await fs.writeFile("public/release.json", release);
  await fs.writeFile("docs/delivery-record.json", JSON.stringify({
    ...record, manifestSha256: hash(release),
  }, null, 2));
  console.log(`${version}: frontend source hashes refreshed; ${manifest.assets.length} verified assets retained.`);
  process.exit(0);
}
const validation = JSON.parse(await fs.readFile("model/validation.json"));
const checks = JSON.parse(await fs.readFile("model/checks.json"));
const provenance = JSON.parse(
  await fs.readFile(`.asset-work/renders/${version}/provenance.json`),
);
const sourceHash = hash(await fs.readFile(`art_src/${spec.assetStem}.blend`));
const specHash = hash(await fs.readFile("model/apartment.json"));
if (
  validation.version !== version ||
  !validation.roundtrip_pass ||
  validation.source_sha256 !== sourceHash ||
  validation.spec_sha256 !== specHash ||
  validation.glb_sha256 !==
    hash(await fs.readFile(`asset_exchange/${spec.assetStem}.glb`)) ||
  checks.passed !== checks.total
)
  throw Error("Validate the current model before preparing a release.");
for (const p of validation.model_packages ?? []) {
  if(hash(await fs.readFile(p.path)) !== p.sha256) throw Error(`Revalidate model package ${p.path}`);
}
for (const view of spec.renderViews) {
  const record = provenance.images?.[view.id];
  const source =
    record ??
    (provenance.views.some((v) => v.id === view.id) ? provenance : null);
  if (
    !source ||
    source.sourceSha256 !== sourceHash ||
    source.specSha256 !== specHash
  )
    throw Error(`Re-render ${view.id}: image and model versions differ.`);
  if (
    record &&
    record.sha256 !==
      hash(await fs.readFile(`.asset-work/renders/${version}/${view.id}.png`))
  )
    throw Error(`Render image changed: ${view.id}`);
}
async function asset(path, role, source) {
  const bytes = await fs.readFile(source ?? `public/${path}`);
  assets.push({
    path,
    role,
    ...(source ? { source } : {}),
    bytes: bytes.length,
    sha256: hash(bytes),
  });
}
for (const width of [640, 1000, 1600]) {
  const path = `${prefix}/images/hero-${width}.webp`;
  await sharp(`.asset-work/renders/${version}/hero.png`)
    .resize({ width })
    .webp({ quality: 82 })
    .toFile(`public/${path}`);
  await asset(path, "hero");
}
const renderTitles = {
  hero: "全屋视角",
  reference: "当前模型",
  living: "客厅",
  kitchen: "厨房",
  master: "主卧",
  masterbath: "主卫",
  study: "书房",
  "study-cabinet": "书房柜体",
};
for (const id of ["reference", "living", "kitchen", "master", "masterbath", "study", "study-cabinet"].filter(id => spec.renderViews.some(v => v.id === id))) {
  const path = `${prefix}/images/${id}.webp`;
  await sharp(`.asset-work/renders/${version}/${id}.png`)
    .resize({ width: id === "reference" ? 1400 : 1100 })
    .webp({ quality: 86 })
    .toFile(`public/${path}`);
  images.push({
    id,
    title: renderTitles[id],
    path,
    kind: "模型渲染",
    version,
    caption: `由当前 ${version} 源模型以 Cycles 渲染；家具、空间、门向及构件与交互模型同步。家具外观按用户参考建模，尺寸依据见构件属性。`,
  });
  await asset(path, "render");
}
for(const effect of designSelections.flatMap(s=>s.display_effects ?? []).filter(effect => !effect.kind.startsWith("历史"))) {
  const imagePath=`${prefix}/images/${effect.id}.webp`;
  await sharp(effect.source).resize({width:1448,withoutEnlargement:true}).webp({quality:90}).toFile(`public/${imagePath}`);
  images.push({id:effect.id,title:effect.title,path:imagePath,kind:effect.kind,version:effect.designVersion,caption:effect.caption});
  await asset(imagePath, 'design-effect');
}
const references = [
  [
    "plan",
    "floor-plan.png",
    "原始户型图",
    "原始图纸",
    "原始分段尺寸与门洞朝向依据；图中家具、柜体和电梯外部布局不等于当前模型的展示范围。",
  ],
  [
    "photo-living",
    "entry-living.jpg",
    "客厅实景",
    "实拍",
    "入户看向南侧客厅；相邻墙面依据后续修订保留素墙。",
  ],
  [
    "photo-north",
    "north-room-kitchen.jpg",
    "北侧实景",
    "实拍 · 已脱敏",
    "已移除人物和倒影，遮挡处经 AI 补绘；X 空间门扇以当前模型的收起状态为准。",
  ],
  [
    "photo-master",
    "southwest-master.jpg",
    "主卧实景",
    "实拍",
    "主卧人字拼木地板；柜体按后续修订移除。",
  ],
  [
    "photo-southeast",
    "southeast-bedroom.jpg",
    "东南卧室实景",
    "实拍",
    "保留直铺木地板，东侧墙面包覆已按后续修订移除。",
  ],
  [
    "photo-hall",
    "hall-materials-v04.png",
    "客厅柜细节",
    "实拍参考",
    "灰褐木饰面、灰绿石材、薄分格和暖色灯带。",
  ],
  [
    "photo-vanity",
    "master-double-basin-v04.png",
    "主卫宽槽细节",
    "实拍 · 已脱敏",
    "镜中拍摄者及手机已移除并补绘背景；一体连续宽槽配两组墙出龙头。",
  ],
  [
    "photo-fridge",
    "kitchen-fridge.jpg",
    "冰箱与水槽",
    "实拍",
    "西侧双门冰箱、北窗下水槽与 U 形台面。",
  ],
  [
    "photo-hob",
    "kitchen-hob.jpg",
    "烟机与灶具",
    "实拍",
    "东侧三眼灶、斜面烟机与嵌入式烤箱。",
  ],
  [
    "photo-slider",
    "north-frame-v04.png",
    "北侧推拉门",
    "实拍 · 已脱敏",
    "已去除人物与倒影；薄深色门扇及外围框。",
  ],
  [
    "photo-bathdoor",
    "master-sliding-door-v04.png",
    "主卫推拉门",
    "实拍 · 已脱敏",
    "已去除人像倒影与视频按钮；门扇收在入口右侧。",
  ],
];
for (const [id, file, title, kind, caption] of references) {
  const path = `${prefix}/images/${id}.webp`;
  await sharp(`public/references/${file}`)
    .resize({ width: id === "plan" ? 1500 : 1200, withoutEnlargement: true })
    .webp({ quality: id === "plan" ? 95 : 84 })
    .toFile(`public/${path}`);
  images.push({
    id,
    title,
    path,
    kind,
    version: "source-reference",
    caption,
  });
  await asset(path, "source-reference");
}
// An illustrated derivative is optional; the authoritative reference always remains the actual render.
try {
  const provenance = JSON.parse(
    await fs.readFile("references/generated/reference-v06.json"),
  );
  if (
    provenance.modelSha256 ===
    hash(await fs.readFile(`asset_exchange/${spec.assetStem}.glb`))
  ) {
    const path = `${prefix}/images/illustration.webp`;
    await sharp("references/generated/reference-v06.png")
      .resize({ width: 1400 })
      .webp({ quality: 86 })
      .toFile(`public/${path}`);
    images.splice(1, 0, {
      id: "illustration",
      title: "更新示意 v06",
      path,
      kind: "AI 生成参考",
      version,
      caption:
        "基于当前模型和脱敏实拍更新的示意图；几何、尺寸以当前模型和派生平面图为准。",
    });
    await asset(path, "generated-reference");
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
for (const pack of packages) {
  await fs.copyFile(`asset_exchange/${pack.assetStem}.glb`, `${out}/${pack.hdFile}`);
  await asset(`${prefix}/${pack.webFile}`, "model");
  await asset(`${prefix}/${pack.hdFile}`, "hd-model", `asset_exchange/${pack.assetStem}.glb`);
}
await asset(`${prefix}/model-packages.json`, "model-report");
await fs.copyFile("model/apartment.json", `${out}/design-spec.json`);
const report = {
  version,
  sourceSha256: validation.source_sha256,
  rawModelSha256: validation.glb_sha256,
  modelPackages: validation.model_packages,
  specSha256: hash(await fs.readFile("model/apartment.json")),
  roundtrip: {
    passed: validation.roundtrip_pass,
    sourceObjects: validation.source_objects,
    importedObjects: validation.reimport_objects,
    triangles: validation.reimport_triangles,
    maximumBoundsErrorMeters: validation.max_bound_error_m,
  },
  checks,
  revisions: spec.revisions,
  designContext: designSelection ? {
    id: designSelection.id,
    selectionSha256: hash(await fs.readFile(spec.furnitureDecision)),
    userAcceptance: designSelection.user_acceptance,
    tableRevision: designSelection.table_revision,
  } : null,
  studyContext: studySelection ? {
    id: studySelection.id,
    selectionSha256: hash(await fs.readFile(spec.studyDecision)),
    userAcceptance: studySelection.user_acceptance,
    layout: studySelection.layout,
    alignment: studySelection.alignment,
  } : null,
  renders: provenance,
  acceptance: {
    visual: "pending-user-review",
    realPhonePerformance: "not-measured",
  },
};
await fs.writeFile(
  `${out}/release-report.json`,
  JSON.stringify(report, null, 2),
);
for (const [path, role] of [
  ["architecture.json", "properties"],
  ["navigation.json", "navigation"],
  ["floor-plan.svg", "drawing"],
  ["design-spec.json", "design-source"],
  ["release-report.json", "report"],
])
  await asset(`${prefix}/${path}`, role);
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"])
  await asset(`decoders/basis/${file}`, "decoder");
await asset("decoders/THREE-LICENSE.txt", "license");
const sources = {};
for (const path of [
  "model/apartment.json",
  "model/resource-budgets.json",
  `art_src/${spec.assetStem}.blend`,
  ...packages.map(p => `asset_exchange/${p.assetStem}.glb`),
  ...spec.furnishings.filter(f => f.source).map(f => f.source.path),
  ...(designSelection?.sofa_revision ? [designSelection.sofa_revision.handoff] : []),
  "scripts/model-packages.mjs",
  "scripts/model_packages.py",
  "scripts/build-apartment.py",
  "scripts/architecture_geometry.py",
  "scripts/furniture_geometry.py",
  ...(spec.studyDecision ? ["scripts/study_geometry.py", "scripts/render-study-review.py"] : []),
  "scripts/render-apartment.py",
  "scripts/render_exterior.py",
  "scripts/environment-data.mjs",
  "scripts/export-apartment.py",
  "scripts/validate-apartment.py",
  "scripts/generate-data.mjs",
  "scripts/optimize-web.mjs",
  "scripts/prepare-release.mjs",
  "scripts/stage-site.mjs",
  ...deploymentSources,
  "index.html",
  "vite.config.js",
  "package.json",
  "package-lock.json",
  ...(spec.furnitureDecision ? [spec.furnitureDecision, nodePath.posix.join(nodePath.posix.dirname(spec.furnitureDecision),'DECISION.md')] : []),
  ...(spec.studyDecision ? [spec.studyDecision, nodePath.posix.join(nodePath.posix.dirname(spec.studyDecision),'DECISION.md')] : []),
  ...new Set((spec.furnitureMaterials ?? []).map(m => m.texture).filter(Boolean)),
  ...new Set(designInputs),
  ...(await fs.readdir("src"))
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => `src/${f}`),
])
  sources[path] = hash(await fs.readFile(path));
const manifest = {
  schemaVersion: 1,
  version,
  presentationRevision: spec.presentationRevision ?? (spec.furnishings?.length ? "2026-10-08-living-v02-table-r2" : "2026-09-15-section-quality"),
  applicationRevision,
  units: "m",
  project: spec.project,
  model: `${prefix}/${packages[0].webFile}`,
  rawModel: `${prefix}/${packages[0].hdFile}`,
  additionalModels: packages.slice(1).map(p=>({id:p.id,model:`${prefix}/${p.webFile}`,rawModel:`${prefix}/${p.hdFile}`})),
  architecture: `${prefix}/architecture.json`,
  navigation: `${prefix}/navigation.json`,
  floorplan: `${prefix}/floor-plan.svg`,
  report: `${prefix}/release-report.json`,
  spec: `${prefix}/design-spec.json`,
  images,
  assets,
  sources,
  budgets: { firstScreenBytes: resourceBudgets.firstScreenBytes, interactive3DBytes: resourceBudgets.interactive3DBytes, webModelBytes: resourceBudgets.webModelBytes },
  visualPolicy:
    "Preserve source texture resolution; native display pixel ratio by default. Smooth mode is opt-in. Resource budgets follow visual quality.",
};
await fs.writeFile("public/release.json", JSON.stringify(manifest, null, 2));
await fs.writeFile(
  "docs/delivery-record.json",
  JSON.stringify(
    {
      ...report,
      releaseManifest: "public/release.json",
      manifestSha256: hash(await fs.readFile("public/release.json")),
    },
    null,
    2,
  ),
);
console.log(
  `${version}: ${assets.length} selected resources, ${(assets.reduce((s, a) => s + a.bytes, 0) / 1024 ** 2).toFixed(2)} MiB including on-demand HD.`,
);

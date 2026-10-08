import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { modelPackages } from "./model-packages.mjs";
import polygonClipping from "polygon-clipping";
import { convexHull, polygonArea, Navigation } from "../src/spatial.js";
const spec = JSON.parse(await fs.readFile("model/apartment.json"));
const version = spec.version,
  out = `public/releases/${version}`;
await fs.mkdir(out, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const docs = await Promise.all(modelPackages(spec).map(pack => io.read(`asset_exchange/${pack.assetStem}.glb`)));
const extent = spec.coordinateSystem.planSouthExtent;
const round = (n) => Math.round(n * 1e5) / 1e5;
const nodeRows = [],
  colliders = [];
for (const node of docs.flatMap(doc=>doc.getRoot().listNodes())) {
  if (!node.getMesh()) continue;
  const m = node.getWorldMatrix(),
    vertices = [],
    extras = node.getExtras();
  for (const primitive of node.getMesh().listPrimitives()) {
    const a = primitive.getAttribute("POSITION"),
      v = [];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      vertices.push([
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
      ]);
    }
  }
  if (!extras.entityId) throw Error(`Missing entity: ${node.getName()}`);
  const min = [0, 1, 2].map((i) => vertices.reduce((n,v)=>Math.min(n,v[i]),Infinity)),
    max = [0, 1, 2].map((i) => vertices.reduce((n,v)=>Math.max(n,v[i]),-Infinity));
  const polygon = convexHull(
    vertices.map((v) => [round(v[0]), round(v[2] + extent)]),
  );
  nodeRows.push({
    name: node.getName(),
    entityId: extras.entityId,
    layer: extras.layer,
    min: min.map(round),
    max: max.map(round),
  });
  if (
    max[1] > spec.navigation.stepHeight &&
    min[1] < spec.navigation.bodyHeight &&
    extras.kind !== "ceiling" &&
    extras.layer !== "cutCap" &&
    polygonArea(polygon) > 1e-6
  ) {
    colliders.push({
      entityId: extras.entityId,
      name: node.getName(),
      polygon,
      minHeight: round(min[1]),
      maxHeight: round(max[1]),
    });
  }
}
const walls = spec.walls.map((w) => {
  const dx = w.b[0] - w.a[0],
    dy = w.b[1] - w.a[1],
    length = Math.hypot(dx, dy),
    x = ((-dy / length) * w.thickness) / 2,
    y = ((dx / length) * w.thickness) / 2;
  return [
    [w.a[0] + x, w.a[1] + y],
    [w.b[0] + x, w.b[1] + y],
    [w.b[0] - x, w.b[1] - y],
    [w.a[0] - x, w.a[1] - y],
  ];
});
const wallUnion = polygonClipping.union(...walls.map((p) => [p]));
const rooms = spec.rooms.map((r) => {
  const polygons = polygonClipping.difference([r.polygon], wallUnion);
  const area = polygons.reduce(
    (sum, p) =>
      sum +
      polygonArea(p[0]) -
      p.slice(1).reduce((s, h) => s + polygonArea(h), 0),
    0,
  );
  return {
    ...r,
    polygons,
    area: Math.round(area * 100) / 100,
    areaLabel: "模型估算；按空间多边形扣除墙体，不含测绘认证",
  };
});
const entities = spec.entities.map((e) => {
  const nodes = nodeRows.filter((n) => n.entityId === e.id);
  if (!nodes.length) throw Error(`Empty entity ${e.id}`);
  const min = [0, 1, 2].map((i) => Math.min(...nodes.map((n) => n.min[i]))),
    max = [0, 1, 2].map((i) => Math.max(...nodes.map((n) => n.max[i])));
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    roomIds: e.roomIds,
    materials: e.materials,
    basis: e.basis,
    min,
    max,
    size: max.map((n, i) => round(n - min[i])),
    nodeCount: nodes.length,
    annotations: spec.annotations.filter((a) => a.entityId === e.id),
    wall: spec.walls.find((w) => w.id === e.wallId),
    window: spec.windowDefinitions.find((w) => w.id === e.windowId),
    door: spec.doors.find((d) => d.id === e.doorId),
  };
});
const data = {
  version,
  project: spec.project,
  coordinateSystem: spec.coordinateSystem,
  height: spec.height,
  outline: spec.outline,
  chains: spec.chains,
  rooms,
  entities,
  materials: [...spec.materials, ...(spec.furnitureMaterials ?? []), ...(spec.externalMaterials ?? [])],
  nodes: nodeRows,
  detailViews: spec.detailViews,
  lighting: spec.lighting,
  presentationEnvironment: spec.presentationEnvironment,
  assumptions: spec.assumptions,
};
const size = spec.navigation.gridSize,
  width = Math.ceil(10.5 / size),
  height = Math.ceil(extent / size);
const navigation = {
  version,
  outline: spec.outline,
  settings: spec.navigation,
  colliders,
  grid: { size, width, height, cells: [] },
  mesh: { vertices: [], triangles: [] },
};
const nav = new Navigation(navigation);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const id = y * width + x;
    if (nav.clear(nav.cellPoint(id))) navigation.grid.cells.push(id);
  }
// The navigation mesh consists of traversable grid quads, triangulated only when all edges are clear.
const cells = new Set(navigation.grid.cells),
  meshIndex = new Map();
const vertex = (id) => {
  if (!meshIndex.has(id)) {
    meshIndex.set(id, navigation.mesh.vertices.length);
    navigation.mesh.vertices.push(nav.cellPoint(id).map(round));
  }
  return meshIndex.get(id);
};
for (const a of cells) {
  const b = a + 1,
    c = a + width,
    d = c + 1;
  if (a % width >= width - 1 || ![b, c, d].every((n) => cells.has(n))) continue;
  if (
    ![
      [a, b],
      [a, c],
      [b, d],
      [c, d],
      [a, d],
    ].every(([i, j]) => nav.segmentClear(nav.cellPoint(i), nav.cellPoint(j)))
  )
    continue;
  navigation.mesh.triangles.push(
    [vertex(a), vertex(b), vertex(d)],
    [vertex(a), vertex(d), vertex(c)],
  );
}
await fs.writeFile(`${out}/architecture.json`, JSON.stringify(data));
await fs.writeFile(`${out}/navigation.json`, JSON.stringify(navigation));
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const path = (polygons) =>
  polygons
    .map((p) =>
      p
        .map((ring) => "M" + ring.map((p) => p.join(",")).join("L") + "Z")
        .join(""),
    )
    .join("");
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1.1 12.6 15.4" role="img" aria-labelledby="title desc"><title id="title">Home 402 平面图 · ${version}</title><desc id="desc">由当前米制模型派生。面积为模型估算，尺寸依据原始图纸及照片估读。</desc><style>text{font-family:system-ui,sans-serif;fill:#39433a}.room{fill:#e9e9dd;stroke:#fcfbf7;stroke-width:.025;cursor:pointer}.room:hover,.room.selected{fill:#b9c3a5}.wall{fill:#5c6258}.opening{stroke:#d9e5de;stroke-width:.13}.window{stroke:#6e8c91;stroke-width:.04}.door{stroke:#ae9270;stroke-width:.035;fill:none}.label{font-size:.23px;text-anchor:middle;pointer-events:none}.small{font-size:.16px}.dim{stroke:#a5a895;stroke-width:.015;fill:none}.entity{stroke:#b6aa98;stroke-width:.02;fill:#e3ded3}.entity.selected{stroke:#bd713d;stroke-width:.07;fill:#e8c6a5}.wall.selected{fill:#bd713d}.window.selected,.door.selected{stroke:#bd713d;stroke-width:.07}[data-entity-id]{cursor:pointer}[role=button]:focus-visible{outline:.035px solid #bd713d}</style><rect x="-1" y="-1.1" width="12.6" height="15.4" fill="#faf9f4"/>` +
  rooms
    .map(
      (r) =>
        `<g data-room-id="${r.id}" tabindex="0" role="button" aria-label="${escape(r.name)}"><path class="room" fill-rule="evenodd" d="${path(r.polygons)}"/><text class="label" x="${r.label[0]}" y="${r.label[1]}">${escape(r.name)}<tspan x="${r.label[0]}" dy=".29" class="small">${r.area.toFixed(2)} m² · 估算</tspan></text></g>`,
    )
    .join("") +
  spec.walls
    .map(
      (w, i) =>
        `<path class="wall" data-entity-id="${escape(spec.entities.find((e) => e.wallId === w.id)?.id ?? "")}" d="${path([[walls[i]]])}"/>` +
        w.openings
          .map((o) => {
            const length = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
            const p = (t) => [
              w.a[0] + ((w.b[0] - w.a[0]) * t) / length,
              w.a[1] + ((w.b[1] - w.a[1]) * t) / length,
            ];
            const a = p(o[0]),
              b = p(o[1]);
            return `<path class="opening" d="M${a.join(",")}L${b.join(",")}"/>`;
          })
          .join(""),
    )
    .join("") +
  entities
    .filter((e) => ["cabinet", "fixture", "furniture"].includes(e.type) && !/rug|art-panels|lamp|items/.test(e.id))
    .map(
      (e) =>
        `<rect class="entity" data-entity-id="${e.id}" x="${e.min[0]}" y="${e.min[2] + extent}" width="${e.size[0]}" height="${e.size[2]}"/>`,
    )
    .join("") +
  spec.windowDefinitions
    .map((w) => {
      const a =
          w.orientation === 0
            ? [w.x - w.width / 2, w.t]
            : [w.x, w.t - w.width / 2],
        b =
          w.orientation === 0
            ? [w.x + w.width / 2, w.t]
            : [w.x, w.t + w.width / 2];
      return `<path class="window" data-entity-id="window_${w.id}" d="M${a.join(",")}L${b.join(",")}"/>`;
    })
    .join("") +
  spec.doors
    .map((d) => {
      const [x, y] = d.hinge,
        angle = d.closedDirection,
        theta = d.openAngle,
        a = [x + d.width * Math.cos(angle), y + d.width * Math.sin(angle)],
        b = [x + d.width * Math.cos(theta), y + d.width * Math.sin(theta)];
      const offset = d.leafOffset ?? [0, 0],
        leafStart = [x + offset[0], y + offset[1]],
        leafEnd = [b[0] + offset[0], b[1] + offset[1]],
        sweep = Math.sin(theta - angle) > 0 ? 1 : 0;
      return `<g class="door" data-entity-id="door_${d.id}"><path d="M${leafStart.join(",")}L${leafEnd.join(",")}M${a.join(",")}A${d.width},${d.width} 0 0 ${sweep} ${b.join(",")}"/><path d="M${x},${y}L${a.join(",")}A${d.width},${d.width} 0 0 ${sweep} ${b.join(",")}Z" style="fill:transparent;stroke:transparent;stroke-width:.12"/></g>`;
    })
    .join("") +
  `<path class="dim" d="M0,13.15V13.65M10.5,13.15V13.65M0,13.5H10.5M-.25,0H-.65M-.25,12.9H-.65M-.5,0V12.9"/><text class="label" x="5.25" y="13.42">10.50 m · 图纸分段合计</text><text class="small" x="-.65" y="6.6" transform="rotate(-90,-.65,6.6)">12.90 m · 图纸分段合计</text><path d="M10.85,.5V-.35M10.65,-.05L10.85,-.45L11.05,-.05" fill="none" stroke="#4a5946" stroke-width=".04"/><text class="label" x="10.85" y="-.6">N</text><path d="M.2,-.5H2.2M.2,-.6V-.4M1.2,-.6V-.4M2.2,-.6V-.4" class="dim"/><text class="small" x=".2" y="-.72">0　　　 1　　　 2 m</text><text class="small" x=".2" y="14">模型派生图 · ${version} · 面积为模型估算，非测绘净面积 · 打印缩放会改变比例</text></svg>`;
await fs.writeFile(`${out}/floor-plan.svg`, svg);
console.log(
  JSON.stringify({
    version,
    rooms: rooms.length,
    entities: entities.length,
    nodes: nodeRows.length,
    colliders: colliders.length,
    walkCells: navigation.grid.cells.length,
    navTriangles: navigation.mesh.triangles.length,
  }),
);

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  Navigation,
  inside,
  polygonArea,
  planToWorld,
  worldToPlan,
  distance,
} from "../src/spatial.js";
const spec = JSON.parse(fs.readFileSync("model/apartment.json"));
const navData = JSON.parse(
  fs.readFileSync(`public/releases/${spec.version}/navigation.json`),
);
const nav = new Navigation(navData);
test("plan coordinates round trip in metres", () => {
  const p = [3.5, 7.55];
  assert.deepEqual(worldToPlan(planToWorld(p, 1.65, 12.9), 12.9), p);
});
test("all room destinations have collision-safe routes including revised doorways", () => {
  for (const room of spec.rooms) {
    const path = nav.route(nav.settings.start, room.walkEntry);
    assert.ok(path?.length, room.id);
    let p = nav.settings.start;
    for (const q of path) {
      assert.ok(nav.segmentClear(p, q), room.id);
      p = q;
    }
    assert.ok(distance(p, room.walkEntry) < 0.6, room.id);
  }
});
test("glass, exterior, closed wall and fixed cabinetry remain solid", () => {
  for (const p of [
    [5.5, 12.85],
    [0.02, 10],
    [11, 8],
    [6.73, 2.5],
    [3.5, 10],
    [8.8, 1.8],
  ])
    assert.equal(nav.clear(p), false, p.join(","));
});
test("large displacement cannot tunnel through a thin wall or leave the house", () => {
  const p = nav.move([5.5, 10], [-20, 0]);
  assert.ok(p[0] > 3.5 + nav.radius);
  assert.ok(nav.clear(p));
  const q = nav.move([5.5, 10], [0, 20]);
  assert.ok(q[1] < 12.9 - nav.radius);
  assert.ok(inside(q, nav.outline));
});
test("diagonal movement slides along a wall while respecting the capsule radius", () => {
  const p = nav.move([7.0, 4.0], [1, 0.7]);
  assert.ok(p[0] > 3.5 + nav.radius);
  assert.ok(p[1] > 4.6);
  assert.ok(nav.clear(p));
});
test("selected furniture blocks walking while both table-side passages stay clear", () => {
  if (!spec.furnishings?.length) return;
  for (const p of [[4.12,10.4],[7.19,10.62],[5.55,6.0],[4.88,6.24],[6.42,6.25]])
    assert.equal(nav.clear(p),false,p.join(","));
  for (const p of [[4.20,6.15],[7.10,6.15],[5.4,10.1]])
    assert.equal(nav.clear(p),true,p.join(","));
});
test("a disconnected destination returns no route", () => {
  const original = nav.outline;
  nav.outline = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  assert.equal(nav.route([0.5, 0.5], [5.5, 10]), null);
  nav.outline = original;
});
test("navigation mesh uses valid triangles over walkable space", () => {
  for (const tri of navData.mesh.triangles) {
    const p = tri.map((i) => navData.mesh.vertices[i]);
    assert.equal(p.length, 3);
    assert.ok(polygonArea(p) > 0.00001);
    for (const point of p) assert.ok(nav.clear(point));
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Sections } from "../src/sections.js";

test("a glTF wall split by material retains a closed vertical cap", () => {
  const scene = new THREE.Scene(),
    model = new THREE.Group(),
    wall = new THREE.Group();
  wall.userData = { entityId: "wall", layer: "lower" };
  wall.position.y = 1;
  const box = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const p = box.attributes.position;
  for (const top of [true, false]) {
    const vertices = [];
    for (let i = 0; i < p.count; i++)
      if ((i >= 12 && i < 18) === top)
        vertices.push(p.getX(i), p.getY(i), p.getZ(i));
    const geometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.userData = { ...wall.userData };
    wall.add(mesh);
  }
  model.add(wall);
  scene.add(model);
  const sections = new Sections(scene, model, 12.9);
  sections.apply({ axis: "x", value: 0.3 }, false);
  assert.equal(sections.caps.children.length, 1);
  const bounds = new THREE.Box3().setFromObject(sections.caps.children[0]);
  assert.equal(bounds.min.y, 0);
  assert.equal(bounds.max.y, 2);
  assert.equal(bounds.min.z, -1);
  assert.equal(bounds.max.z, 1);
  assert.equal(sections.caps.children[0].userData.entityId, "wall");
  sections.dispose();
  box.dispose();
  wall.children.forEach((m) => {
    m.geometry.dispose();
    m.material.dispose();
  });
});
import { cutCoordinate, visibleAt } from "../src/view-state.js";

test("a cut at the legacy split produces outward caps and excludes duplicate seam faces", () => {
  const scene = new THREE.Scene(),
    model = new THREE.Group();
  scene.add(model);
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const lower = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.149999976, 1),
    material,
  );
  lower.position.y = 1.149999976 / 2;
  const upper = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2.8 - 1.150000036, 1),
    material,
  );
  upper.position.y = (2.8 + 1.150000036) / 2;
  upper.userData.layer = "upper";
  model.add(lower, upper);
  const sections = new Sections(scene, model, 12.9),
    section = { axis: "z", value: 1.15 };
  sections.apply(section, false);
  assert.ok(sections.caps.children.length > 0);
  for (const cap of sections.caps.children) {
    const p = cap.geometry.attributes.position,
      n = cap.geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getY(i) - cutCoordinate(section)) < 1e-6);
      assert.ok(n.getY(i) > 0.99);
    }
  }
  assert.equal(visibleAt([0, 1.149999976, 0], section, 12.9), false);
  assert.equal(visibleAt([0, 1.149, 0], section, 12.9), true);
  sections.dispose();
  lower.geometry.dispose();
  upper.geometry.dispose();
  material.dispose();
});

test("overlapping wall cuts remain solids with semantic selection instead of becoming holes", () => {
  const scene = new THREE.Scene(),
    model = new THREE.Group();
  scene.add(model);
  const material = new THREE.MeshStandardMaterial();
  for (const [id, x] of [
    ["first", 0],
    ["second", 1],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    wall.position.set(x, 1, 0);
    wall.userData.entityId = id;
    model.add(wall);
  }
  const sections = new Sections(scene, model, 12.9);
  sections.apply({ axis: "z", value: 1 }, false);
  assert.equal(sections.caps.children.length, 2);
  assert.deepEqual(
    new Set(sections.caps.children.map((c) => c.userData.entityId)),
    new Set(["first", "second"]),
  );
  for (const cap of sections.caps.children) {
    const p = cap.geometry.attributes.position,
      index = cap.geometry.index;
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, index.getX(i)),
        b = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 1)),
        c = new THREE.Vector3().fromBufferAttribute(p, index.getX(i + 2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    assert.ok(Math.abs(area - 4) < 0.0001);
  }
  sections.select("first");
  assert.equal(
    sections.caps.children.find((c) => c.userData.entityId === "first")
      .material,
    sections.selectedMaterial,
  );
  sections.dispose();
  model.children.forEach((m) => m.geometry.dispose());
  material.dispose();
});

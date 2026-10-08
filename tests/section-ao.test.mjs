import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SectionSSAOPass } from "../src/section-ao.js";

test("AO matches the clipped surface, cap depth bias and glass visibility", () => {
  const ao = new SectionSSAOPass(
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
  );
  const wall = new THREE.MeshStandardMaterial();
  wall.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.1498)];
  const cap = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  const glass = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.2,
  });
  const wn = ao.normalFor(wall),
    cn = ao.normalFor(cap);
  assert.equal(wn.clippingPlanes, wall.clippingPlanes);
  assert.equal(cn.clippingPlanes, null);
  assert.equal(cn.polygonOffsetUnits, -4);
  assert.equal(cn.side, THREE.DoubleSide);
  assert.equal(ao.normalFor(glass).visible, false);
  const windowGlass=new THREE.MeshPhysicalMaterial({transmission:.96});
  assert.equal(windowGlass.transparent,false);
  assert.equal(ao.normalFor(windowGlass).visible,false);
  wall.clippingPlanes = [];
  assert.equal(ao.normalFor(wall), wn);
  assert.equal(wn.clippingPlanes.length, 0);
  ao.dispose();
  wall.dispose();
  cap.dispose();
  glass.dispose();
  windowGlass.dispose();
});

test("disposing temporary selection materials releases cached AO materials", () => {
  const ao = new SectionSSAOPass(
    new THREE.Scene(),
    new THREE.PerspectiveCamera(),
  );
  const material = new THREE.MeshStandardMaterial();
  let disposed = 0;
  ao.normalFor(material).addEventListener("dispose", () => disposed++);
  material.dispose();
  assert.equal(disposed, 1);
  assert.equal(ao.normalMaterials.size, 0);
  ao.dispose();
  assert.equal(disposed, 1);
});

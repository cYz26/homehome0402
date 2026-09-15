import * as THREE from "three";
import { inside, polygonArea, edgeDistance } from "./spatial.js";
import { visibleAt, cutCoordinate } from "./view-state.js";

export class Sections {
  constructor(scene, model, extent) {
    this.scene = scene;
    this.model = model;
    this.extent = extent;
    this.caps = new THREE.Group();
    scene.add(this.caps);
    this.material = new THREE.MeshBasicMaterial({
      color: "#b9a68a",
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      // Also bias flat, north-up caps: slope-only bias is zero for this view.
      polygonOffsetUnits: -4,
    });
    this.selectedMaterial = this.material.clone();
    this.selectedMaterial.color.set("#bd713d");
  }
  apply(section, interior) {
    this.section = section;
    this.cutValue = cutCoordinate(section);
    const normal =
      section.axis === "x"
        ? [-1, 0, 0]
        : section.axis === "y"
          ? [0, 0, -1]
          : [0, -1, 0];
    const constant =
      section.axis === "y" ? this.cutValue - this.extent : this.cutValue;
    this.plane = new THREE.Plane(new THREE.Vector3(...normal), constant);
    const planes = section.axis === "off" ? [] : [this.plane];
    this.model.traverse((ob) => {
      if (!ob.isMesh) return;
      ob.visible =
        ob.userData.layer !== "cutCap" &&
        (interior || ob.userData.layer !== "ceiling");
      for (const m of Array.isArray(ob.material)
        ? ob.material
        : [ob.material]) {
        const previous = m.clippingPlanes?.length ?? 0;
        m.clippingPlanes = planes;
        m.clipShadows = true;
        if (previous !== planes.length) m.needsUpdate = true;
      }
    });
    this.clearCaps();
    if (section.axis !== "off") this.buildCaps();
    this.select(this.selectedId);
  }
  visible(point) {
    return visibleAt(point.toArray(), this.section, this.extent);
  }
  clearCaps() {
    for (const c of [...this.caps.children]) {
      c.geometry.dispose();
      this.caps.remove(c);
    }
  }
  buildCaps() {
    this.model.updateMatrixWorld(true);
    const plane = this.plane,
      axis = this.section.axis,
      rings = [];
    const project = (v) =>
      axis === "z" ? [v.x, v.z] : axis === "x" ? [v.z, v.y] : [v.x, v.y];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    const groups = new Map();
    this.model.traverse((ob) => {
      if (
        !ob.isMesh ||
        !ob.visible ||
        ob.material.transparent ||
        ob.userData.part === "mirror"
      )
        return;
      const materials = Array.isArray(ob.material)
        ? ob.material
        : [ob.material];
      if (materials.some((m) => m.transparent)) return;
      const owner =
        ob.parent?.userData.entityId === ob.userData.entityId &&
        ob.parent.children.every((child) => child.isMesh)
          ? ob.parent
          : ob;
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(ob);
    });
    for (const [owner, meshes] of groups) {
      const edges = new Map();
      const key = (p) => p.map((n) => Math.round(n * 10000)).join(",");
      // glTF separates a multi-material solid into primitive meshes. Its top
      // and sides must contribute to one contour, otherwise vertical cuts open.
      for (const ob of meshes) {
        const geometry = ob.geometry,
          positions = geometry.attributes.position,
          index = geometry.index,
          count = index?.count ?? positions.count;
        for (let i = 0; i < count; i += 3) {
          a.fromBufferAttribute(
            positions,
            index ? index.getX(i) : i,
          ).applyMatrix4(ob.matrixWorld);
          b.fromBufferAttribute(
            positions,
            index ? index.getX(i + 1) : i + 1,
          ).applyMatrix4(ob.matrixWorld);
          c.fromBufferAttribute(
            positions,
            index ? index.getX(i + 2) : i + 2,
          ).applyMatrix4(ob.matrixWorld);
          const points = [],
            vs = [a, b, c];
          for (let j = 0; j < 3; j++) {
            const p = vs[j],
              q = vs[(j + 1) % 3],
              d = plane.distanceToPoint(p),
              e = plane.distanceToPoint(q);
            if ((d < 0 && e >= 0) || (d >= 0 && e < 0))
              points.push(project(p.clone().lerp(q, d / (d - e))));
          }
          if (points.length !== 2 || key(points[0]) === key(points[1]))
            continue;
          for (let j = 0; j < 2; j++) {
            const k = key(points[j]);
            if (!edges.has(k)) edges.set(k, []);
            edges.get(k).push(points[1 - j]);
          }
        }
      }
      while (edges.size) {
        const [first, neighbors] = edges.entries().next().value;
        if (!neighbors.length) {
          edges.delete(first);
          continue;
        }
        const loop = [neighbors[0]],
          firstKey = key(loop[0]);
        let current = firstKey,
          prior = null,
          closed = false;
        for (let i = 0; i <= edges.size + 1000; i++) {
          const list = edges.get(current);
          if (!list?.length) break;
          const next = list.find((p) => key(p) !== prior) ?? list[0],
            nextKey = key(next);
          list.splice(list.indexOf(next), 1);
          if (!list.length) edges.delete(current);
          const reverse = edges.get(nextKey);
          if (reverse) {
            const at = reverse.findIndex((p) => key(p) === current);
            if (at >= 0) reverse.splice(at, 1);
            if (!reverse.length) edges.delete(nextKey);
          }
          if (nextKey === firstKey) {
            closed = true;
            break;
          }
          loop.push(next);
          prior = current;
          current = nextKey;
        }
        if (closed && loop.length >= 3 && polygonArea(loop) > 0.00001)
          rings.push({ points: loop, owner });
        // Degenerate/open contours are omitted instead of drawing invented closure surfaces.
      }
    }
    // Nesting preserves openings (for example the continuous vanity trough).
    const sorted = rings.sort(
        (a, b) => polygonArea(b.points) - polygonArea(a.points),
      ),
      shapes = [];
    for (let i = 0; i < sorted.length; i++) {
      const ring = sorted[i],
        parents = sorted
          .slice(0, i)
          .filter(
            (p) =>
              p.owner === ring.owner &&
              polygonArea(p.points) > polygonArea(ring.points) + 0.00001 &&
              ring.points.every(
                (v) =>
                  inside(v, p.points) || edgeDistance(v, p.points) < 0.00001,
              ),
          );
      const path = new THREE.Path(
        ring.points.map((p) => new THREE.Vector2(...p)),
      );
      if (parents.length % 2) {
        const parent = parents.at(-1),
          target = shapes.find((s) => s.ring === parent);
        if (target) target.shape.holes.push(path);
      } else
        shapes.push({
          ring,
          shape: new THREE.Shape(
            ring.points.map((p) => new THREE.Vector2(...p)),
          ),
        });
    }
    for (const { shape, ring } of shapes) {
      const geometry = new THREE.ShapeGeometry(shape),
        mesh = new THREE.Mesh(geometry, this.material);
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i);
        if (axis === "z") p.setXYZ(i, x, this.cutValue, y);
        else if (axis === "x") p.setXYZ(i, this.cutValue, y, x);
        else p.setXYZ(i, x, y, this.cutValue - this.extent);
      }
      // The XZ and ZY projections reverse winding. Caps face the removed half
      // space so the AO normal pass sees the same surface as the beauty pass.
      if (axis !== "y")
        for (let i = 0; i < geometry.index.count; i += 3) {
          const b = geometry.index.getX(i + 1);
          geometry.index.setX(i + 1, geometry.index.getX(i + 2));
          geometry.index.setX(i + 2, b);
        }
      geometry.computeVertexNormals();
      mesh.userData = { ...ring.owner.userData };
      mesh.renderOrder = 2;
      this.caps.add(mesh);
    }
  }
  select(id) {
    this.selectedId = id;
    this.caps.children.forEach((cap) => {
      cap.material =
        id && cap.userData.entityId === id
          ? this.selectedMaterial
          : this.material;
    });
  }
  dispose() {
    this.clearCaps();
    this.material.dispose();
    this.selectedMaterial.dispose();
    this.scene.remove(this.caps);
  }
}

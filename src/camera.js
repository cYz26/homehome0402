import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clamp } from "./spatial.js";
export class Cameras {
  constructor(canvas, extent, invalidate) {
    this.extent = extent;
    this.invalidate = invalidate;
    this.ortho = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.025, 100);
    this.perspective = new THREE.PerspectiveCamera(72, 1, 0.025, 80);
    this.active = this.ortho;
    this.yaw = 0;
    this.pitch = 0;
    this.controls = new OrbitControls(this.ortho, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.15;
    this.controls.minZoom = 0.5;
    this.controls.maxZoom = 5;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minPolarAngle = 0.025;
    this.controls.addEventListener("change", invalidate);
    this.controls.addEventListener("start", () => {
      this.transition = null;
    });
  }
  point(p, h = 0) {
    return new THREE.Vector3(p[0], h, p[1] - this.extent);
  }
  resize(w, h) {
    this.aspect = w / h;
    const span = Math.max(14, 14.5 / this.aspect);
    Object.assign(this.ortho, {
      left: (-span * this.aspect) / 2,
      right: (span * this.aspect) / 2,
      top: span / 2,
      bottom: -span / 2,
    });
    this.ortho.updateProjectionMatrix();
    this.perspective.aspect = this.aspect;
    this.perspective.updateProjectionMatrix();
    this.invalidate();
  }
  setMode(mode) {
    this.mode = mode;
    const interior = ["interior", "walk"].includes(mode);
    this.active = interior ? this.perspective : this.ortho;
    this.controls.enabled = !interior;
    this.controls.enableRotate = mode === "orbit";
    this.controls.minPolarAngle = mode === "top" ? 0 : 0.025;
    this.transition = null;
  }
  frame(room, immediate = false) {
    const target = this.point(room?.label ?? [5.2, 6.4], 0.15);
    const position = target
      .clone()
      .add(
        this.mode === "top"
          ? new THREE.Vector3(0, 26, 0.001)
          : new THREE.Vector3(9, 23, 16),
      );
    this.tween(
      position,
      target,
      room ? (this.aspect < 0.8 ? 2 : 1.7) : 0.9,
      immediate,
    );
  }
  interior(view, immediate = false) {
    this.perspective.fov = Math.min(
      96,
      (view.fov ?? 72) + (this.aspect < 0.8 ? 14 : 0),
    );
    this.perspective.updateProjectionMatrix();
    this.tween(
      this.point(view.camera, view.eye ?? 1.65),
      this.point(view.look, view.targetHeight ?? 1.35),
      1,
      immediate,
    );
  }
  tween(position, target, zoom, immediate) {
    const camera = this.active;
    if (immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera.position.copy(position);
      camera.lookAt(target);
      if (camera.isOrthographicCamera) {
        camera.zoom = zoom;
        this.controls.target.copy(target);
      }
      camera.updateProjectionMatrix();
      this.angles(target);
      this.invalidate();
      return;
    }
    const fromTarget = camera.isOrthographicCamera
      ? this.controls.target.clone()
      : camera.position
          .clone()
          .add(camera.getWorldDirection(new THREE.Vector3()));
    this.transition = {
      start: performance.now(),
      from: camera.position.clone(),
      position,
      fromTarget,
      target,
      fromZoom: camera.zoom,
      zoom,
    };
    this.invalidate();
  }
  angles(target) {
    if (!this.active.isPerspectiveCamera) return;
    const d = target.clone().sub(this.active.position).normalize();
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(clamp(d.y, -1, 1));
  }
  look(yaw, pitch) {
    this.transition = null;
    this.yaw += yaw;
    this.pitch = clamp(this.pitch + pitch, -1.3, 1.3);
    this.perspective.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.invalidate();
  }
  update(time) {
    if (this.transition) {
      const t = this.transition,
        progress = clamp((time - t.start) / 650, 0, 1),
        eased = 1 - (1 - progress) ** 3;
      this.active.position.lerpVectors(t.from, t.position, eased);
      const target = t.fromTarget.clone().lerp(t.target, eased);
      this.active.lookAt(target);
      if (this.active.isOrthographicCamera) {
        this.controls.target.copy(target);
        this.active.zoom = THREE.MathUtils.lerp(t.fromZoom, t.zoom, eased);
        this.active.updateProjectionMatrix();
      }
      this.angles(target);
      this.invalidate();
      if (progress === 1) this.transition = null;
    }
    if (this.controls.enabled) this.controls.update();
  }
  snapshot() {
    const c = this.active,
      target = c.isOrthographicCamera
        ? this.controls.target
        : c.position
            .clone()
            .add(c.getWorldDirection(new THREE.Vector3()).multiplyScalar(2));
    return {
      position: c.position.toArray(),
      target: target.toArray(),
      zoom: c.zoom,
      fov: this.perspective.fov,
    };
  }
  restore(state) {
    this.transition = null;
    this.active.position.fromArray(state.position);
    const target = new THREE.Vector3(...state.target);
    this.active.lookAt(target);
    this.active.zoom = state.zoom;
    this.perspective.fov = state.fov;
    this.active.updateProjectionMatrix();
    this.controls.target.copy(target);
    this.angles(target);
    this.invalidate();
  }
  dispose() {
    this.controls.dispose();
  }
}

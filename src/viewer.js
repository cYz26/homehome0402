import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { ApartmentScene } from "./scene.js";
import { Cameras } from "./camera.js";
import { Sections } from "./sections.js";
import { Navigation, inside, clamp, distance } from "./spatial.js";
import { WalkInput } from "./walk-input.js";
import { initialState } from "./view-state.js";
import { abortable } from "./resources.js";

export class ApartmentViewer {
  constructor(container, data, navigation, onChange, notify) {
    this.container = container;
    this.data = data;
    this.onChange = onChange;
    this.notify = notify;
    this.state = initialState();
    this.abort = new AbortController();
    this.nav = new Navigation(navigation);
    this.extent = data.coordinateSystem.planSouthExtent;
    this.rendering = new ApartmentScene(container, data);
    this.canvas = this.rendering.canvas;
    this.cameras = new Cameras(this.canvas, this.extent, () =>
      this.invalidate(),
    );
    this.input = new WalkInput(this.canvas, {
      active: () => ["interior", "walk"].includes(this.state.mode),
      manual: () => {
        this.path = null;
        this.cameras.transition = null;
      },
      look: (yaw, pitch) => this.cameras.look(yaw, pitch),
      height: (delta) => {
        if (this.state.mode === "walk") this.adjustHeight(delta);
      },
      select: (event) => this.pick(event),
      zoom: (delta) => {
        this.cameras.perspective.fov = clamp(
          this.cameras.perspective.fov + delta * 0.025,
          45,
          96,
        );
        this.cameras.perspective.updateProjectionMatrix();
        this.invalidate();
      },
      exit: () => this.setMode("orbit"),
      stop: () => {
        this.path = null;
        this.lastTime = null;
      },
    });
    const options = { signal: this.abort.signal };
    this.canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (["orbit", "top"].includes(this.state.mode))
          this.pickStart = [e.clientX, e.clientY];
      },
      options,
    );
    this.canvas.addEventListener(
      "pointerup",
      (e) => {
        if (
          this.pickStart &&
          distance(this.pickStart, [e.clientX, e.clientY]) < 5 &&
          ["orbit", "top"].includes(this.state.mode)
        )
          this.pick(e);
        this.pickStart = null;
      },
      options,
    );
    this.canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        this.input.reset();
        this.notify("图形上下文已中断，请点“重新加载 3D”恢复。", true);
      },
      options,
    );
    this.resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (w && h) {
        this.cameras.resize(w, h);
        this.rendering.resize();
        this.updateVisibility?.();
        this.invalidate();
      }
    });
    this.resizeObserver.observe(container);
    this.updateVisibility = () => {
      const bounds = container.getBoundingClientRect();
      const visible =
        bounds.bottom > 0 &&
        bounds.top < innerHeight &&
        bounds.right > 0 &&
        bounds.left < innerWidth;
      if (visible !== this.inView) {
        this.inView = visible;
        this.lastTime = null;
        if (visible) this.invalidate();
        else this.input.reset();
      }
    };
    this.inView = true;
    // Re-evaluate after native and programmatic scrolling, including returning
    // from a dialog. A stale observer notification must not leave input paused.
    document.addEventListener("scroll", this.updateVisibility, {
      ...options,
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", this.updateVisibility, options);
    document.addEventListener(
      "visibilitychange",
      () => {
        this.lastTime = null;
        if (!document.hidden) this.invalidate();
      },
      options,
    );
    this.selected = [];
    this.dirty = true;
    this.running = true;
    this.frames = [];
    this.lastPublish = 0;
    this.rendering.setQuality(this.state.quality);
    this.setMode("orbit", true);
    this.animate = this.animate.bind(this);
    this.animation = requestAnimationFrame(this.animate);
  }
  async load(manifest, signal, onStage, bytes) {
    const url = (path) => import.meta.env.BASE_URL + path;
    this.ktx = new KTX2Loader()
      .setTranscoderPath(url("decoders/basis/"))
      .setWorkerLimit(2)
      .detectSupport(this.rendering.renderer);
    const loader = new GLTFLoader()
      .setKTX2Loader(this.ktx)
      .setMeshoptDecoder(MeshoptDecoder);
    signal?.throwIfAborted();
    onStage?.("decode");
    const parsed = loader
      .parseAsync(
        bytes,
        url(manifest.model.substring(0, manifest.model.lastIndexOf("/") + 1)),
      )
      .then((gltf) => {
        if (!this.running || signal?.aborted) {
          gltf.scene.traverse((ob) => {
            ob.geometry?.dispose();
            for (const m of ob.material
              ? Array.isArray(ob.material)
                ? ob.material
                : [ob.material]
              : []) {
              for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
              m.dispose();
            }
          });
          throw new DOMException("Loading cancelled", "AbortError");
        }
        return gltf;
      });
    const gltf = await abortable(parsed, signal);
    onStage?.("render");
    this.ktx.dispose();
    this.model = gltf.scene;
    this.model.traverse((ob) => {
      if (ob.isMesh) {
        let owner = ob;
        while (owner && !owner.userData.entityId) owner = owner.parent;
        if (owner) ob.userData = { ...owner.userData, ...ob.userData };
      }
    });
    this.rendering.addModel(this.model);
    this.sections = new Sections(this.rendering.scene, this.model, this.extent);
    this.cameras.resize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
    this.setMode(this.state.mode, true);
    // Render one complete model frame before dismissing the loading image, even
    // when the intersection observer has paused the offscreen animation loop.
    this.rendering.render(this.cameras.active);
  }
  get room() {
    return this.data.rooms.find((r) => r.id === this.state.roomId);
  }
  get entity() {
    return this.data.entities.find((e) => e.id === this.state.entityId);
  }
  setMode(mode, immediate = false) {
    this.input?.reset();
    this.state.mode = mode;
    this.cameras.setMode(mode);
    const interior = ["interior", "walk"].includes(mode);
    this.rendering.setCamera(this.cameras.active, interior);
    if (mode === "walk") {
      this.state.section = { axis: "off", value: this.data.height };
      const candidate = [
        this.cameras.perspective.position.x,
        this.cameras.perspective.position.z + this.extent,
      ];
      const id = this.nav.nearest(
        this.room?.walkEntry ?? this.nav.settings.start,
        1,
      );
      this.walkPosition = this.nav.clear(candidate)
        ? candidate
        : id !== null
          ? this.nav.cellPoint(id)
          : [...this.nav.settings.start];
      this.cameras.perspective.position.copy(
        this.cameras.point(this.walkPosition, this.state.eyeHeight),
      );
      this.cameras.look(0, 0);
      this.canvas.focus({ preventScroll: true });
    } else if (mode === "interior") {
      this.state.section = { axis: "off", value: this.data.height };
      this.cameras.interior(this.room ?? this.data.rooms[0], immediate);
    } else {
      if (this.state.section.axis === "off")
        this.state.section = { axis: "z", value: 1.15 };
      this.cameras.frame(this.room, immediate);
    }
    this.applySection();
    this.changed();
  }
  selectRoom(id, frame = true) {
    this.selectEntity(null, false);
    this.state.roomId = id;
    if (frame) {
      if (this.state.mode === "walk" && this.room) {
        this.path = this.nav.route(this.walkPosition, this.room.walkEntry);
        this.notify(
          this.path
            ? `沿可通行路线前往${this.room.name}；触摸画面或按键可停止。`
            : `${this.room.name}暂时没有可通行路线，可使用定点观景查看。`,
        );
      } else if (this.state.mode === "interior")
        this.cameras.interior(this.room ?? this.data.rooms[0]);
      else this.cameras.frame(this.room);
    }
    this.highlightRoom();
    this.changed();
  }
  detail(id) {
    const view = this.data.detailViews.find((v) => v.id === id);
    if (!view) return;
    this.state.roomId = view.room;
    this.setMode("interior");
    this.cameras.interior(view);
    this.changed();
  }
  selectEntity(id, updateRoom = true) {
    for (const { ob, materials } of this.selected) {
      (Array.isArray(ob.material) ? ob.material : [ob.material]).forEach((m) =>
        m.dispose(),
      );
      ob.material = materials;
    }
    this.selected = [];
    this.state.entityId = id;
    this.sections?.select(id);
    if (id && this.model) {
      this.model.traverse((ob) => {
        if (!ob.isMesh || ob.userData.entityId !== id) return;
        const materials = ob.material;
        this.selected.push({ ob, materials });
        const tint = (m) => {
          const c = m.clone();
          if (c.emissive) {
            c.emissive.set("#bd713d");
            c.emissiveIntensity = 0.32;
          }
          return c;
        };
        ob.material = Array.isArray(materials)
          ? materials.map(tint)
          : tint(materials);
      });
      if (updateRoom && this.entity?.roomIds.length)
        this.state.roomId = this.entity.roomIds.includes(this.state.roomId)
          ? this.state.roomId
          : this.entity.roomIds[0];
    }
    this.highlightRoom();
    this.changed();
  }
  highlightRoom() {
    if (this.roomHighlight) {
      this.rendering.scene.remove(this.roomHighlight);
      this.roomHighlight.children.forEach((c) => c.geometry.dispose());
      this.roomHighlight = null;
    }
    if (!this.room || ["interior", "walk"].includes(this.state.mode)) return;
    this.roomHighlightMaterial ??= new THREE.MeshBasicMaterial({
      color: "#879974",
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const planes =
      this.state.section.axis === "off"
        ? []
        : [this.sections?.plane].filter(Boolean);
    if (
      (this.roomHighlightMaterial.clippingPlanes?.length ?? 0) !== planes.length
    )
      this.roomHighlightMaterial.needsUpdate = true;
    this.roomHighlightMaterial.clippingPlanes = planes;
    this.roomHighlight = new THREE.Group();
    for (const p of this.room.polygons) {
      const shape = new THREE.Shape(
        p[0].map(([x, t]) => new THREE.Vector2(x, t - this.extent)),
      );
      p.slice(1).forEach((r) =>
        shape.holes.push(
          new THREE.Path(
            r.map(([x, t]) => new THREE.Vector2(x, t - this.extent)),
          ),
        ),
      );
      const g = new THREE.ShapeGeometry(shape),
        a = g.attributes.position;
      for (let i = 0; i < a.count; i++)
        a.setXYZ(i, a.getX(i), 0.036, a.getY(i));
      const m = new THREE.Mesh(g, this.roomHighlightMaterial);
      m.renderOrder = 1;
      this.roomHighlight.add(m);
    }
    this.rendering.scene.add(this.roomHighlight);
  }
  pick(event) {
    if (!this.model) return;
    const b = this.canvas.getBoundingClientRect(),
      pointer = new THREE.Vector2(
        ((event.clientX - b.left) / b.width) * 2 - 1,
        (-(event.clientY - b.top) / b.height) * 2 + 1,
      );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.cameras.active);
    const hit = ray
      .intersectObjects([this.model, this.sections.caps], true)
      .find((h) => {
        for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
        return h.object.userData.entityId && this.sections.visible(h.point);
      });
    if (hit) {
      const e = this.data.entities.find(
          (e) => e.id === hit.object.userData.entityId,
        ),
        p = [hit.point.x, hit.point.z + this.extent];
      const r = this.data.rooms.find(
        (r) => e?.roomIds.includes(r.id) && inside(p, r.polygon),
      );
      if (r) this.state.roomId = r.id;
      this.selectEntity(hit.object.userData.entityId);
    } else this.selectEntity(null);
  }
  setSection(axis, value) {
    this.state.section = { axis, value };
    this.applySection();
    this.changed();
  }
  applySection() {
    const interior = ["interior", "walk"].includes(this.state.mode);
    this.sections?.apply(this.state.section, interior);
    this.rendering.ao.normalMaterial.clippingPlanes =
      this.state.section.axis === "off"
        ? []
        : [this.sections?.plane].filter(Boolean);
    const mirror = this.rendering.mirror,
      proxy = this.rendering.mirrorProxy;
    if (mirror && proxy) {
      mirror.visible =
        interior &&
        this.state.section.axis === "off" &&
        this.state.quality === "standard";
      proxy.visible =
        !mirror.visible && (interior || this.state.section.axis !== "off");
    }
    if (this.roomHighlightMaterial)
      this.roomHighlightMaterial.clippingPlanes =
        this.state.section.axis === "off"
          ? []
          : [this.sections?.plane].filter(Boolean);
    this.highlightRoom();
    this.invalidate();
  }
  setQuality(q) {
    this.state.quality = q;
    this.rendering.setQuality(q);
    this.applySection();
    this.changed();
  }
  adjustHeight(delta) {
    this.state.eyeHeight = clamp(
      this.state.eyeHeight + delta,
      this.nav.settings.minEyeHeight,
      this.nav.settings.maxEyeHeight,
    );
    this.cameras.perspective.position.y = this.state.eyeHeight;
    this.changed();
  }
  reset() {
    this.state = initialState();
    this.selectEntity(null);
    this.setMode("orbit");
  }
  restore(state) {
    this.state = { ...state };
    this.setMode(state.mode, true);
    this.state.section = state.section;
    if (state.camera) this.cameras.restore(state.camera);
    if (state.mode === "walk") {
      const p = [
        this.cameras.perspective.position.x,
        this.cameras.perspective.position.z + this.extent,
      ];
      if (this.nav.clear(p)) this.walkPosition = p;
      else this.notify("分享机位位于障碍内，已恢复到安全机位。");
      this.cameras.perspective.position.copy(
        this.cameras.point(this.walkPosition, this.state.eyeHeight),
      );
    }
    this.rendering.setQuality(state.quality);
    this.selectEntity(state.entityId);
    this.applySection();
    this.changed();
  }
  snapshot() {
    return { ...this.state, camera: this.cameras.snapshot() };
  }
  async screenshot() {
    this.rendering.render(this.cameras.active);
    return await new Promise((resolve) =>
      this.canvas.toBlob(resolve, "image/png"),
    );
  }
  changed() {
    this.invalidate();
    this.onChange?.(this.snapshot());
  }
  invalidate() {
    this.dirty = true;
    this.tailFrames = 3;
  }
  step(dt, time) {
    if (!["interior", "walk"].includes(this.state.mode)) return;
    const input = this.input.sample(time);
    if (input.yaw || input.pitch)
      this.cameras.look(input.yaw * dt, input.pitch * dt);
    if (this.state.mode !== "walk") return;
    if (input.height) this.adjustHeight(input.height * dt * 0.45);
    let delta = [0, 0],
      yaw = this.cameras.yaw;
    if (input.forward || input.side) {
      const scale =
        (this.nav.settings.speed * dt) /
        Math.max(1, Math.hypot(input.forward, input.side));
      delta = [
        (-Math.sin(yaw) * input.forward + Math.cos(yaw) * input.side) * scale,
        (-Math.cos(yaw) * input.forward - Math.sin(yaw) * input.side) * scale,
      ];
    } else if (this.path?.length) {
      const goal = this.path[0],
        d = distance(this.walkPosition, goal),
        step = Math.min(d, this.nav.settings.speed * dt);
      delta = d
        ? [
            ((goal[0] - this.walkPosition[0]) / d) * step,
            ((goal[1] - this.walkPosition[1]) / d) * step,
          ]
        : [0, 0];
      if (d < 0.025) this.path.shift();
      else {
        const wanted = Math.atan2(-delta[0], -delta[1]);
        this.cameras.look(
          Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw)) *
            Math.min(1, dt * 6),
          0,
        );
      }
    }
    if (delta[0] || delta[1]) {
      this.walkPosition = this.nav.move(this.walkPosition, delta);
      this.cameras.perspective.position.copy(
        this.cameras.point(this.walkPosition, this.state.eyeHeight),
      );
      this.invalidate();
    }
  }
  animate(time) {
    if (!this.running) return;
    this.animation = requestAnimationFrame(this.animate);
    // The preview covers the canvas until load() installs and draws the model.
    // Compiling empty-scene AO/shadows here delays download progress and input.
    if (!this.model || document.hidden || !this.inView) {
      this.lastTime = null;
      return;
    }
    const raw = this.lastTime == null ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;
    let dt = Math.min(raw, this.nav.settings.maxFrameDelta);
    while (dt > 0.00001) {
      const step = Math.min(dt, this.nav.settings.fixedStep);
      this.step(step, time);
      dt -= step;
    }
    this.cameras.update(time);
    if (this.dirty || this.tailFrames > 0) {
      this.rendering.render(this.cameras.active);
      this.dirty = false;
      this.tailFrames--;
      if (raw > 0 && raw < 1) {
        this.frames.push(raw * 1000);
        if (this.frames.length > 180) this.frames.shift();
      }
      if (time - this.lastPublish > 500) {
        this.lastPublish = time;
        this.onChange?.(this.snapshot());
      }
    }
  }
  performance() {
    const a = [...this.frames].sort((a, b) => a - b);
    return {
      sampleFrames: a.length,
      medianMs: a[Math.floor(a.length / 2)] ?? null,
      p95Ms: a[Math.floor(a.length * 0.95)] ?? null,
      drawCalls: this.rendering.renderer.info.render.calls,
      triangles: this.rendering.renderer.info.render.triangles,
    };
  }
  dispose() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.animation);
    this.abort.abort();
    this.input.dispose();
    this.resizeObserver.disconnect();
    this.selectEntity(null);
    this.sections?.dispose();
    this.cameras.dispose();
    this.ktx?.dispose();
    this.rendering.dispose();
  }
}

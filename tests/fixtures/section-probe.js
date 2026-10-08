import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ApartmentScene } from "../../src/scene.js";
import { Sections } from "../../src/sections.js";
const base = import.meta.env.BASE_URL;
const manifest = await (await fetch(`${base}release.json`)).json();
const data = await (
  await fetch(`${base}${manifest.architecture}`)
).json();
// Seed AO sampling so a failed pixel comparison is reproducible.
let seed = 402;
Math.random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
const app = new ApartmentScene(document.querySelector("#stage"), data);
if (new URLSearchParams(location.search).has("legacy")) {
  const old = app.ao;
  app.ao = new SSAOPass(app.scene, app.pass.camera, 1, 1, 8);
  app.ao.kernelRadius = old.kernelRadius;
  app.ao.minDistance = old.minDistance;
  app.ao.maxDistance = old.maxDistance;
  app.composer.passes[1] = app.ao;
  old.dispose();
}
const loader = new GLTFLoader();
const ktx = new KTX2Loader()
  .setTranscoderPath(`${base}decoders/basis/`)
  .detectSupport(app.renderer);
loader.setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
const asset = new URLSearchParams(location.search).get("asset") ?? "web";
const model = new THREE.Group();
for (const pack of [manifest,...(manifest.additionalModels ?? [])]) {
  model.add((await loader.loadAsync(`${base}${asset === "hd" ? pack.rawModel : pack.model}`)).scene);
}
model.traverse((ob) => {
  if (!ob.isMesh) return;
  let owner = ob;
  while (owner && !owner.userData.entityId) owner = owner.parent;
  if (owner) ob.userData = { ...owner.userData, ...ob.userData };
});
app.addModel(model);
const section = new Sections(app.scene, model, 12.9);
const camera = new THREE.OrthographicCamera(-6.4, 6.4, 4.8, -4.8, 0.025, 100);
app.setCamera(camera, false);
app.setQuality("standard");
window.probe = ({
  ao = true,
  shadows = true,
  zoom = 1,
  full = true,
  value = 1.15,
  axis = "z",
  focusWall = true,
} = {}) => {
  section.apply({ axis, value }, false);
  if (!full) {
    model.traverse((o) => {
      if (o.isMesh) o.visible &&= o.userData.entityId === "wall_west_south";
    });
    section.caps.children.forEach(
      (o) => (o.visible = o.userData.entityId === "wall_west_south"),
    );
  }
  app.ground.visible = full;
  app.ao.enabled = ao;
  app.sun.castShadow = shadows;
  const target =
    full && !focusWall
      ? new THREE.Vector3(5.2, 0.15, -6.5)
      : new THREE.Vector3(0, 0.8, -3.7);
  camera.position.copy(target).add(new THREE.Vector3(9, 23, 16));
  camera.lookAt(target);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  app.render(camera);
  const gl = app.renderer.getContext(),
    pixel = new Uint8Array(4),
    colors = [];
  for (let i = 0; i < 120; i++) {
    const t = i / 119;
    const p = (
      axis === "z"
        ? new THREE.Vector3(0, section.cutValue, -6.8 + t * 6.2)
        : axis === "x"
          ? new THREE.Vector3(section.cutValue, 0.7, -6.8 + t * 6.2)
          : new THREE.Vector3(0, 0.5 + t * 1.7, section.cutValue - 12.9)
    ).project(camera);
    const x = Math.round((p.x * 0.5 + 0.5) * (gl.drawingBufferWidth - 1)),
      y = Math.round((p.y * 0.5 + 0.5) * (gl.drawingBufferHeight - 1));
    if (
      x < 4 ||
      y < 4 ||
      x >= gl.drawingBufferWidth - 4 ||
      y >= gl.drawingBufferHeight - 4
    )
      continue;
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    colors.push([...pixel.slice(0, 3)]);
  }
  const luminance = colors.map((p) => p.reduce((a, b) => a + b, 0) / 3),
    mean = luminance.reduce((a, b) => a + b, 0) / luminance.length;
  return {
    image: app.canvas.toDataURL(),
    capBounds: section.caps.children
      .filter((o) => o.userData.entityId === "wall_west_south")
      .map((o) => {
        const b = new THREE.Box3().setFromObject(o);
        return {
          layer: o.userData.layer,
          min: b.min.toArray(),
          max: b.max.toArray(),
        };
      }),
    sampleCount: colors.length,
    mean,
    stdev: Math.sqrt(
      luminance.reduce((s, v) => s + (v - mean) ** 2, 0) / luminance.length,
    ),
    range: Math.max(...luminance) - Math.min(...luminance),
    quality: {
      pixelRatio: app.renderer.getPixelRatio(),
      nativePixelRatio: devicePixelRatio,
      samples: app.composer.renderTarget1.samples,
      ao: app.ao.enabled,
      shadow: app.sun.castShadow,
      mirror: app.mirror?.getRenderTarget().width,
    },
  };
};
window.ready = true;

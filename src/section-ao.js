import { MeshNormalMaterial, NoBlending } from "three";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

// SSAOPass's single override material loses the clipping and depth-offset state
// of each surface. Keep its AO algorithm, but render the same visible surfaces
// as the colour pass, including un-clipped caps. Glass does not become an
// opaque occluder in this pass.
export class SectionSSAOPass extends SSAOPass {
  constructor(...args) {
    super(...args);
    this.normalMaterials = new Map();
  }
  normalFor(source) {
    let normal = this.normalMaterials.get(source);
    if (!normal) {
      normal = new MeshNormalMaterial({ blending: NoBlending });
      this.normalMaterials.set(source, normal);
      const release = () => {
        normal.dispose();
        source.removeEventListener("dispose", release);
        this.normalMaterials.delete(source);
      };
      normal.userData.release = release;
      source.addEventListener("dispose", release);
    }
    const planeCount = normal.clippingPlanes?.length ?? 0;
    normal.clippingPlanes = source.clippingPlanes;
    normal.clipIntersection = source.clipIntersection;
    normal.side = source.side;
    normal.flatShading = source.flatShading;
    normal.polygonOffset = source.polygonOffset;
    normal.polygonOffsetFactor = source.polygonOffsetFactor;
    normal.polygonOffsetUnits = source.polygonOffsetUnits;
    normal.visible = source.visible && !source.transparent;
    if (planeCount !== (normal.clippingPlanes?.length ?? 0))
      normal.needsUpdate = true;
    return normal;
  }
  _renderOverride(renderer, _material, target, color, alpha) {
    const saved = [],
      reflectors = [];
    const autoUpdate = renderer.shadowMap.autoUpdate;
    this.scene.traverse((object) => {
      if (object.isReflector && object.visible) {
        reflectors.push(object);
        object.visible = false;
      } else if (object.isMesh) {
        saved.push([object, object.material]);
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => this.normalFor(m))
          : this.normalFor(object.material);
      }
    });
    // Shadows have already been rendered with the real materials in RenderPass.
    renderer.shadowMap.autoUpdate = false;
    try {
      // The base implementation only needs clearColor/clearAlpha here; a null
      // override lets each mesh keep its matching normal material.
      renderer.getClearColor(this._originalClearColor);
      const oldAlpha = renderer.getClearAlpha();
      const oldAutoClear = renderer.autoClear;
      const oldOverride = this.scene.overrideMaterial;
      try {
        renderer.setRenderTarget(target);
        renderer.autoClear = false;
        renderer.setClearColor(color, alpha);
        renderer.clear();
        this.scene.overrideMaterial = null;
        renderer.render(this.scene, this.camera);
      } finally {
        this.scene.overrideMaterial = oldOverride;
        renderer.autoClear = oldAutoClear;
        renderer.setClearColor(this._originalClearColor, oldAlpha);
      }
    } finally {
      for (const [object, material] of saved) object.material = material;
      for (const object of reflectors) object.visible = true;
      renderer.shadowMap.autoUpdate = autoUpdate;
    }
  }
  dispose() {
    for (const material of [...this.normalMaterials.values()])
      material.userData.release();
    this.normalMaterials.clear();
    // These resources are omitted by SSAOPass.dispose() in Three.js r180.
    this.ssaoMaterial.dispose();
    this.noiseTexture.dispose();
    super.dispose();
  }
}

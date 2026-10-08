import test from "node:test";
import assert from "node:assert/strict";
import { ApartmentViewer } from "../src/viewer.js";

test("the animation loop waits for the model before drawing behind its preview", (t) => {
  const oldDocument = globalThis.document;
  const oldFrame = globalThis.requestAnimationFrame;
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = () => 1;
  t.after(() => {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
    if (oldFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = oldFrame;
  });
  let draws = 0;
  const viewer = {
    running: true, inView: true, dirty: true,
    nav: { settings: {} }, cameras: { update() {} },
    rendering: { render() { draws++; } }, frames: [], lastPublish: 0,
  };
  ApartmentViewer.prototype.animate.call(viewer, 100);
  assert.equal(draws, 0, "no empty full-quality frames while downloading");
  assert.equal(viewer.dirty, true, "keep the first model frame pending");
  viewer.model = {};
  ApartmentViewer.prototype.animate.call(viewer, 200);
  assert.equal(draws, 1, "normal rendering resumes when the model arrives");
  ApartmentViewer.prototype.animate.call(viewer, 216);
  ApartmentViewer.prototype.animate.call(viewer, 232);
  assert.equal(draws, 1, "a static frame does not repeat expensive glass/mirror passes");
  viewer.cameras.update = () => ApartmentViewer.prototype.invalidate.call(viewer);
  ApartmentViewer.prototype.animate.call(viewer, 248);
  ApartmentViewer.prototype.animate.call(viewer, 264);
  assert.equal(draws, 3, "camera changes continue drawing every new view");
});

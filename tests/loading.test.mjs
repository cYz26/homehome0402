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
    running: true, inView: true, dirty: true, tailFrames: 3,
    nav: { settings: {} }, cameras: { update() {} },
    rendering: { render() { draws++; } }, lastPublish: 0,
  };
  ApartmentViewer.prototype.animate.call(viewer, 100);
  assert.equal(draws, 0, "no empty full-quality frames while downloading");
  assert.equal(viewer.dirty, true, "keep the first model frame pending");
  viewer.model = {};
  ApartmentViewer.prototype.animate.call(viewer, 200);
  assert.equal(draws, 1, "normal rendering resumes when the model arrives");
});

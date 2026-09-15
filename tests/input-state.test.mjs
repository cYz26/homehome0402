import test from "node:test";
import assert from "node:assert/strict";
import { TouchGesture } from "../src/walk-input.js";
import {
  initialState,
  encodeView,
  decodeView,
  visibleAt,
} from "../src/view-state.js";
const data = {
  height: 2.8,
  rooms: [{ id: "master" }],
  entities: [{ id: "door_master" }],
};
test("single finger swipe looks in both axes immediately, without starting movement", () => {
  const g = new TouchGesture();
  g.down(1, 100, 100, 0);
  assert.deepEqual(g.move(1, 130, 80, 40), { yaw: -0.12, pitch: 0.08 });
  assert.equal(g.tick(500), false);
  assert.equal(g.up(1, 510), false);
});
test("stationary hold starts walking, continues with looking, and release stops it", () => {
  const g = new TouchGesture();
  g.down(1, 100, 100, 0);
  assert.equal(g.tick(200), false);
  assert.equal(g.tick(280), true);
  assert.deepEqual(g.move(1, 115, 120, 350), { yaw: -0.06, pitch: -0.08 });
  assert.equal(g.forward, true);
  g.up(1, 400);
  assert.equal(g.forward, false);
});
test("quick tap selects, pointer cancellation never selects", () => {
  const g = new TouchGesture();
  g.down(1, 0, 0, 0);
  assert.equal(g.up(1, 100), true);
  g.down(1, 0, 0, 200);
  assert.equal(g.up(1, 250, true), false);
});
test("two-finger long hold changes height and cannot accidentally resume one-finger walking", () => {
  const g = new TouchGesture();
  g.down(1, 100, 100, 0);
  g.tick(300);
  g.down(2, 200, 100, 310);
  assert.equal(g.forward, false);
  assert.deepEqual(g.move(1, 100, 90, 400), {});
  g.tick(670);
  assert.deepEqual(g.move(1, 100, 50, 700), { height: 0.08 });
  g.up(2, 750);
  assert.equal(g.tick(1200), false);
  assert.deepEqual(g.move(1, 110, 60, 1300), {});
  g.up(1, 1400);
  g.down(3, 0, 0, 1500);
  assert.equal(g.tick(1800), true);
});
test("reset clears long-press and all pointer identities", () => {
  const g = new TouchGesture();
  g.down(1, 0, 0, 0);
  g.tick(400);
  g.reset();
  assert.equal(g.tick(10000), false);
  assert.equal(g.pointers.size, 0);
});
test("view URL restores room, component, mode, camera and clipping", () => {
  const s = {
    ...initialState(),
    mode: "walk",
    roomId: "master",
    entityId: "door_master",
    eyeHeight: 1.76,
    section: { axis: "x", value: 4.25 },
    camera: { position: [3, 1.76, -4], target: [3, 1.7, -6], zoom: 1, fov: 78 },
  };
  assert.deepEqual(decodeView(encodeView(s), data), s);
});
test("malformed or unrelated hashes are safely ignored and unsafe values clamped", () => {
  assert.equal(decodeView("#explore", data), null);
  assert.equal(decodeView("#view=%7Bbroken", data), null);
  const s = decodeView(
    encodeView({
      ...initialState(),
      eyeHeight: 100,
      roomId: "unknown",
      entityId: "unknown",
    }),
    data,
  );
  assert.equal(s.eyeHeight, 1.9);
  assert.equal(s.roomId, null);
  assert.equal(s.entityId, null);
});
test("clipped-away surfaces cannot be selected on any axis", () => {
  assert.equal(visibleAt([3, 2, -6], { axis: "z", value: 1.15 }, 12.9), false);
  assert.equal(visibleAt([3, 1, -6], { axis: "z", value: 1.15 }, 12.9), true);
  assert.equal(visibleAt([6, 1, -6], { axis: "x", value: 5 }, 12.9), false);
  assert.equal(visibleAt([3, 1, -2], { axis: "y", value: 7 }, 12.9), false);
  assert.equal(visibleAt([3, 2, -6], { axis: "off", value: 0 }, 12.9), true);
});

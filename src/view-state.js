import { clamp } from "./spatial.js";
export const MODES = ["orbit", "top", "interior", "walk"];
export const initialState = () => ({
  mode: "orbit",
  roomId: null,
  entityId: null,
  section: { axis: "z", value: 1.15 },
  quality: "standard",
  eyeHeight: 1.65,
});
export function encodeView(state) {
  const round = (_, v) =>
    typeof v === "number" ? Math.round(v * 10000) / 10000 : v;
  return (
    "#view=" + encodeURIComponent(JSON.stringify({ v: 1, ...state }, round))
  );
}
export function decodeView(hash, data) {
  if (!hash.startsWith("#view=") || hash.length > 5000) return null;
  try {
    const s = JSON.parse(decodeURIComponent(hash.slice(6)));
    if (s.v !== 1 || !MODES.includes(s.mode)) return null;
    const result = initialState();
    result.mode = s.mode;
    result.quality = s.quality === "smooth" ? "smooth" : "standard";
    result.roomId = data.rooms.some((r) => r.id === s.roomId) ? s.roomId : null;
    result.entityId = data.entities.some((e) => e.id === s.entityId)
      ? s.entityId
      : null;
    result.eyeHeight = Number.isFinite(s.eyeHeight)
      ? clamp(s.eyeHeight, 1.25, 1.9)
      : 1.65;
    if (
      s.section &&
      ["off", "x", "y", "z"].includes(s.section.axis) &&
      Number.isFinite(s.section.value)
    )
      result.section = {
        axis: s.section.axis,
        value: clamp(
          s.section.value,
          0,
          s.section.axis === "z"
            ? data.height
            : s.section.axis === "x"
              ? 10.6
              : 13,
        ),
      };
    const vector = (v) =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => Number.isFinite(n) && Math.abs(n) < 100);
    if (
      s.camera &&
      vector(s.camera.position) &&
      vector(s.camera.target) &&
      Number.isFinite(s.camera.zoom) &&
      Number.isFinite(s.camera.fov)
    )
      result.camera = {
        position: s.camera.position,
        target: s.camera.target,
        zoom: clamp(s.camera.zoom, 0.4, 8),
        fov: clamp(s.camera.fov, 40, 100),
      };
    return result;
  } catch {
    return null;
  }
}
// Move a fraction of a millimetre inside the retained solid to avoid GPU
// precision exposing both faces of the historical upper/lower split.
export const cutCoordinate = (section) => Math.max(0, section.value - 0.0002);
// Same half-space rule is used for ray picking and the renderer's clipping plane.
export function visibleAt(point, section, extent) {
  if (section.axis === "off") return true;
  const coordinate =
    section.axis === "z"
      ? point[1]
      : section.axis === "x"
        ? point[0]
        : point[2] + extent;
  return coordinate <= cutCoordinate(section) + 0.0000001;
}

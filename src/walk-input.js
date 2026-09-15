// Pure gesture state machine: finger motion always looks around, stationary hold moves.
export class TouchGesture {
  constructor() {
    this.reset();
  }
  reset() {
    this.pointers = new Map();
    this.forward = false;
    this.blocked = false;
    this.multi = false;
    this.heightActive = false;
    this.canHold = false;
    this.tap = false;
  }
  down(id, x, y, time) {
    this.pointers.set(id, { x, y, startX: x, startY: y });
    this.tap = false;
    if (this.pointers.size === 1 && !this.blocked) {
      this.since = time;
      this.canHold = true;
      this.moved = false;
    } else {
      this.forward = false;
      this.canHold = false;
      this.multi = true;
      this.blocked = true;
      this.multiSince = time;
      this.heightActive = false;
    }
  }
  tick(time) {
    if (
      this.pointers.size === 1 &&
      this.canHold &&
      !this.blocked &&
      time - this.since >= 280
    )
      this.forward = true;
    if (this.pointers.size === 2 && time - this.multiSince >= 350)
      this.heightActive = true;
    return this.forward;
  }
  move(id, x, y, time) {
    const p = this.pointers.get(id);
    if (!p) return {};
    this.tick(time);
    const dx = x - p.x,
      dy = y - p.y;
    p.x = x;
    p.y = y;
    if (Math.hypot(x - p.startX, y - p.startY) > 7) {
      this.moved = true;
      if (!this.forward) this.canHold = false;
    }
    if (this.pointers.size === 2)
      return this.heightActive ? { height: -dy * 0.002 } : {};
    if (this.pointers.size !== 1 || this.blocked) return {};
    return { yaw: -dx * 0.004, pitch: -dy * 0.004 };
  }
  up(id, time, cancelled = false) {
    const tapped =
      !cancelled &&
      this.pointers.size === 1 &&
      !this.blocked &&
      !this.moved &&
      !this.forward &&
      time - this.since < 280;
    this.pointers.delete(id);
    this.forward = false;
    this.canHold = false;
    // Never restart movement when the second finger lifts. Require a new gesture.
    if (!this.pointers.size) this.reset();
    return tapped;
  }
}

export class WalkInput {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.gesture = new TouchGesture();
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    const on = (element, event, fn, extra = {}) =>
      element.addEventListener(event, fn, { ...options, ...extra });
    // Pointer cancellation and touch-action do not suppress every mobile
    // selection/callout gesture. Own native touch defaults while looking/walking;
    // pointer events remain the single source of movement and selection input.
    const preventNativeGesture = (event) => {
      if (callbacks.active() && event.cancelable) event.preventDefault();
    };
    on(canvas, "touchstart", preventNativeGesture, { passive: false });
    on(canvas, "touchmove", preventNativeGesture, { passive: false });
    on(canvas, "selectstart", preventNativeGesture);
    on(canvas, "pointerdown", (e) => {
      if (!callbacks.active() || e.button !== 0) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      callbacks.manual();
      if (e.pointerType === "touch")
        this.gesture.down(e.pointerId, e.clientX, e.clientY, performance.now());
      else
        this.mouse = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
    });
    on(canvas, "pointermove", (e) => {
      if (!callbacks.active()) return;
      if (e.pointerType === "touch") {
        const change = this.gesture.move(
          e.pointerId,
          e.clientX,
          e.clientY,
          performance.now(),
        );
        if (change.height) callbacks.height(change.height);
        if (change.yaw || change.pitch)
          callbacks.look(change.yaw, change.pitch);
      } else if (this.mouse?.id === e.pointerId) {
        const p = this.mouse;
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 5)
          p.moved = true;
        callbacks.look(-(e.clientX - p.x) * 0.004, -(e.clientY - p.y) * 0.004);
        p.x = e.clientX;
        p.y = e.clientY;
      }
    });
    const up = (e) => {
      if (e.pointerType === "touch") {
        if (
          this.gesture.up(
            e.pointerId,
            performance.now(),
            e.type !== "pointerup",
          )
        )
          callbacks.select(e);
      } else if (this.mouse?.id === e.pointerId) {
        if (!this.mouse.moved && e.type === "pointerup") callbacks.select(e);
        this.mouse = null;
      }
    };
    on(canvas, "pointerup", up);
    on(canvas, "pointercancel", up);
    on(canvas, "lostpointercapture", (e) => {
      if (
        this.gesture.pointers.has(e.pointerId) ||
        this.mouse?.id === e.pointerId
      )
        this.reset();
    });
    on(canvas, "keydown", (e) => {
      if (!callbacks.active()) return;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyQ",
          "KeyE",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        this.keys.add(e.code);
        callbacks.manual();
      }
      if (e.code === "Escape") {
        this.reset();
        callbacks.exit();
      }
    });
    on(window, "keyup", (e) => this.keys.delete(e.code));
    on(canvas, "blur", () => this.reset());
    on(window, "blur", () => this.reset());
    on(document, "visibilitychange", () => {
      if (document.hidden) this.reset();
    });
    on(
      canvas,
      "wheel",
      (e) => {
        if (callbacks.active()) {
          e.preventDefault();
          callbacks.zoom(e.deltaY);
        }
      },
      { passive: false },
    );
    on(canvas, "contextmenu", (e) => {
      if (callbacks.active()) e.preventDefault();
    });
  }
  sample(time) {
    const k = this.keys;
    return {
      forward:
        Number(k.has("KeyW") || this.gesture.tick(time)) -
        Number(k.has("KeyS")),
      side: Number(k.has("KeyD")) - Number(k.has("KeyA")),
      height: Number(k.has("KeyE")) - Number(k.has("KeyQ")),
      yaw: Number(k.has("ArrowLeft")) - Number(k.has("ArrowRight")),
      pitch: Number(k.has("ArrowUp")) - Number(k.has("ArrowDown")),
    };
  }
  reset() {
    this.keys.clear();
    this.gesture.reset();
    this.mouse = null;
    this.callbacks.stop?.();
  }
  dispose() {
    this.reset();
    this.abort.abort();
  }
}

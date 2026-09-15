// Plan space is metres: x east, t south. Independent of Three.js and display clipping.
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function inside(p, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
export function segmentDistance(p, a, b) {
  const x = b[0] - a[0],
    y = b[1] - a[1];
  const t = clamp(
    ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y || 1),
    0,
    1,
  );
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
export const edgeDistance = (p, poly) =>
  Math.min(
    ...poly.map((a, i) => segmentDistance(p, a, poly[(i + 1) % poly.length])),
  );
export function polygonArea(poly) {
  return (
    Math.abs(
      poly.reduce((sum, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2
  );
}
export function convexHull(points) {
  const p = [
    ...new Map(
      points.map((v) => [v.map((n) => n.toFixed(5)).join(","), v]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (rows) => {
    const h = [];
    for (const v of rows) {
      while (h.length > 1 && cross(h.at(-2), h.at(-1), v) <= 0) h.pop();
      h.push(v);
    }
    return h.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}
export const planToWorld = (p, height, extent) => [p[0], height, p[1] - extent];
export const worldToPlan = (p, extent) => [p[0], p[2] + extent];

export class Navigation {
  constructor(data) {
    Object.assign(this, data);
    this.radius = data.settings.radius;
    this.cells = new Set(data.grid.cells);
    this.obstacles = data.colliders.filter(
      (c) =>
        c.maxHeight > data.settings.stepHeight &&
        c.minHeight < data.settings.bodyHeight,
    );
    // Broad phase keeps long-press walking inexpensive without changing physical colliders.
    this.buckets = new Map();
    for (const c of this.obstacles) {
      const xs = c.polygon.map((p) => p[0]),
        ys = c.polygon.map((p) => p[1]);
      c.bounds = [
        Math.min(...xs) - this.radius,
        Math.min(...ys) - this.radius,
        Math.max(...xs) + this.radius,
        Math.max(...ys) + this.radius,
      ];
      for (let x = Math.floor(c.bounds[0]); x <= Math.floor(c.bounds[2]); x++)
        for (
          let y = Math.floor(c.bounds[1]);
          y <= Math.floor(c.bounds[3]);
          y++
        ) {
          const key = `${x},${y}`;
          if (!this.buckets.has(key)) this.buckets.set(key, []);
          this.buckets.get(key).push(c);
        }
    }
  }
  clear(p) {
    if (!inside(p, this.outline) || edgeDistance(p, this.outline) < this.radius)
      return false;
    for (const c of this.buckets.get(
      `${Math.floor(p[0])},${Math.floor(p[1])}`,
    ) ?? []) {
      const b = c.bounds;
      if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
      if (inside(p, c.polygon) || edgeDistance(p, c.polygon) < this.radius)
        return false;
    }
    return true;
  }
  segmentClear(a, b) {
    const steps = Math.ceil(distance(a, b) / (this.radius / 3));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      if (!this.clear([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]))
        return false;
    }
    return true;
  }
  move(start, delta) {
    let p = [...start];
    const n = Math.max(1, Math.ceil(Math.hypot(...delta) / (this.radius / 3)));
    for (let i = 0; i < n; i++) {
      const x = delta[0] / n,
        y = delta[1] / n,
        next = [p[0] + x, p[1] + y];
      if (this.clear(next)) p = next;
      else if (this.clear([p[0] + x, p[1]])) p[0] += x;
      else if (this.clear([p[0], p[1] + y])) p[1] += y;
    }
    return p;
  }
  cellPoint(id) {
    return [
      ((id % this.grid.width) + 0.5) * this.grid.size,
      (Math.floor(id / this.grid.width) + 0.5) * this.grid.size,
    ];
  }
  nearest(p, maxDistance = 1) {
    let result = null,
      best = maxDistance;
    for (const id of this.cells) {
      const q = this.cellPoint(id),
        d = distance(p, q);
      if (d < best) {
        best = d;
        result = id;
      }
    }
    return result;
  }
  route(start, target) {
    const a = this.nearest(start, 0.5),
      b = this.nearest(target, 0.6);
    if (
      a === null ||
      b === null ||
      !this.segmentClear(start, this.cellPoint(a))
    )
      return null;
    const goal = this.clear(target) ? target : this.cellPoint(b);
    if (this.segmentClear(start, goal)) return [goal];
    const open = new Set([a]),
      cost = new Map([[a, 0]]),
      previous = new Map();
    while (open.size) {
      let id,
        best = Infinity;
      for (const n of open) {
        const f = cost.get(n) + distance(this.cellPoint(n), goal);
        if (f < best) {
          best = f;
          id = n;
        }
      }
      if (id === b) {
        const path = [goal];
        let current = b;
        while (current !== a) {
          path.unshift(this.cellPoint(current));
          current = previous.get(current);
        }
        path.unshift(this.cellPoint(a));
        const smooth = [];
        let from = start,
          i = 0;
        while (i < path.length) {
          let j = i;
          while (j + 1 < path.length && this.segmentClear(from, path[j + 1]))
            j++;
          smooth.push(path[j]);
          from = path[j];
          i = j + 1;
        }
        return smooth;
      }
      open.delete(id);
      const p = this.cellPoint(id);
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1]) {
          if (!dx && !dy) continue;
          const x = (id % this.grid.width) + dx,
            y = Math.floor(id / this.grid.width) + dy;
          if (x < 0 || x >= this.grid.width || y < 0 || y >= this.grid.height)
            continue;
          const n = y * this.grid.width + x,
            q = this.cellPoint(n),
            next = cost.get(id) + distance(p, q);
          if (
            !this.cells.has(n) ||
            next >= (cost.get(n) ?? Infinity) ||
            !this.segmentClear(p, q)
          )
            continue;
          previous.set(n, id);
          cost.set(n, next);
          open.add(n);
        }
    }
    return null;
  }
}

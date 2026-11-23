// Line drawings as Float32Arrays of segments (x0 y0 z0 x1 y1 z1 each): fit, cut into n pieces, sort, morph.
// No imports, so Node tests and the browser use the same file.

function box(segs) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < segs.length; i++) {
    const a = i % 3;
    if (segs[i] < lo[a]) lo[a] = segs[i];
    if (segs[i] > hi[a]) hi[a] = segs[i];
  }
  return { lo, hi };
}

// Where a drawing's centre is and how much to scale it: its largest side `w` long, or (with `h`) inside a w x h box.
// Kept from the rest pose and applied to every moving pose, so an object acting out its idea doesn't re-centre.
export function fitParams(segs, w, h) {
  const { lo, hi } = box(segs), ext = (a) => Math.max(hi[a] - lo[a], 1e-9);
  const k = h === undefined ? w / Math.max(ext(0), ext(1), ext(2)) : Math.min(w / ext(0), h / ext(1));
  return { c: [0, 1, 2].map((a) => (lo[a] + hi[a]) / 2), k };
}
export const applyFit = (segs, { c, k }) => segs.map((v, i) => (v - c[i % 3]) * k);

// Centred on the origin, its largest side `size` long.
export const fit = (segs, size) => applyFit(segs, fitParams(segs, size));

// Centred on the origin, scaled to fit inside a w x h box (for groups, whose height matters as much as their width).
export const fitBox = (segs, w, h) => applyFit(segs, fitParams(segs, w, h));

// n pieces: each segment gets a share by its length (largest remainder) and is cut evenly, so no piece
// ever joins two segments. A segment too short for a piece drops out.
export function resample(segs, n) {
  const m = segs.length / 6, len = new Float64Array(m);
  let total = 0;
  for (let s = 0; s < m; s++) {
    const o = s * 6;
    len[s] = Math.hypot(segs[o + 3] - segs[o], segs[o + 4] - segs[o + 1], segs[o + 5] - segs[o + 2]);
    total += len[s];
  }
  const out = new Float32Array(n * 6);
  if (!total) return out;
  const want = Array.from(len, (l) => (l / total) * n), count = want.map(Math.floor);
  let left = n - count.reduce((a, b) => a + b, 0);
  for (const s of want.map((w, s) => [w - Math.floor(w), s]).sort((a, b) => b[0] - a[0]).map(([, s]) => s)) {
    if (!left) break;
    count[s]++;
    left--;
  }
  let p = 0;
  for (let s = 0; s < m; s++) {
    const o = s * 6;
    for (let j = 0; j < count[s]; j++, p++)
      for (let a = 0; a < 3; a++) {
        const d = segs[o + 3 + a] - segs[o + a];
        out[p * 6 + a] = segs[o + a] + (d * j) / count[s];
        out[p * 6 + 3 + a] = segs[o + a] + (d * (j + 1)) / count[s];
      }
  }
  return out;
}

const spread = (v) => { // 10 bits to every third bit
  v = (v | (v << 16)) & 0x030000ff;
  v = (v | (v << 8)) & 0x0300f00f;
  v = (v | (v << 4)) & 0x030c30c3;
  return (v | (v << 2)) & 0x09249249;
};

// Pieces sorted by the Morton code of their midpoints, so piece i of one drawing sits near piece i of another.
export function zorder(pieces) {
  const n = pieces.length / 6, { lo, hi } = box(pieces), code = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let a = 0; a < 3; a++) {
      const mid = (pieces[i * 6 + a] + pieces[i * 6 + 3 + a]) / 2, span = hi[a] - lo[a] || 1;
      c |= spread(Math.min(1023, Math.floor(((mid - lo[a]) / span) * 1024))) << a;
    }
    code[i] = c >>> 0;
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => code[a] - code[b]);
  const out = new Float32Array(pieces.length);
  order.forEach((src, i) => out.set(pieces.subarray(src * 6, src * 6 + 6), i * 6));
  return out;
}

export const morph = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// The morph as a wave: pieces leave in their sorted order (spread = how much of the morph the wave takes), each on
// the travel curve, and bow out sideways mid-flight (swirl, in fitted units) in a direction fixed per piece.
export function morphStagger(a, b, k, { spread = 0.6, swirl = 0.3 } = {}) {
  const n = a.length / 6, out = new Float32Array(a.length);
  for (let i = 0; i < n; i++) {
    const e = ease(Math.min(1, Math.max(0, k * (1 + spread) - spread * (i / Math.max(1, n - 1)))));
    const bow = Math.sin(Math.PI * e) * swirl, d = [Math.sin(i * 12.9898), Math.sin(i * 78.233), Math.sin(i * 37.719)];
    const len = Math.hypot(...d) || 1;
    for (let j = 0; j < 6; j++) out[i * 6 + j] = a[i * 6 + j] + (b[i * 6 + j] - a[i * 6 + j]) * e + (d[j % 3] / len) * bow;
  }
  return out;
}

// cubic-bezier(0.7, 0, 0.3, 1): the curve for a move that travels through the frame
export function ease(k) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const bez = (t, p1, p2) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  let t = k;
  for (let i = 0; i < 8; i++) {
    const d = 3 * (1 - t) * (1 - t) * 0.7 + 6 * (1 - t) * t * (0.3 - 0.7) + 3 * t * t * (1 - 0.3);
    t = Math.min(1, Math.max(0, t - (bez(t, 0.7, 0.3) - k) / (d || 1e-6)));
  }
  return bez(t, 0, 1);
}

export function morphK(t, beatT, { lead = 0.4, tail = 0.1 } = {}) {
  return ease((t - (beatT - lead)) / (lead + tail));
}

// n copies of a drawing fitted to size 1, laid out in rows (the back row a little further away), for "four robots"
export const LAYOUT = {
  2: [[-0.6, 0, 0], [0.6, 0, 0]],
  3: [[-0.6, -0.55, 0.2], [0.6, -0.55, 0.2], [0, 0.55, -0.2]],
  4: [[-0.6, -0.6, 0.2], [0.6, -0.6, 0.2], [-0.6, 0.6, -0.2], [0.6, 0.6, -0.2]],
  5: [[-1.2, -0.6, 0.2], [0, -0.6, 0.2], [1.2, -0.6, 0.2], [-0.6, 0.6, -0.2], [0.6, 0.6, -0.2]],
  6: [[-1.2, -0.6, 0.2], [0, -0.6, 0.2], [1.2, -0.6, 0.2], [-1.2, 0.6, -0.2], [0, 0.6, -0.2], [1.2, 0.6, -0.2]],
};
export function copies(segs, n) {
  if (n === 1) return segs;
  const out = new Float32Array(segs.length * n);
  LAYOUT[n].forEach((d, c) => {
    for (let i = 0; i < segs.length; i++) out[c * segs.length + i] = segs[i] + d[i % 3];
  });
  return out;
}

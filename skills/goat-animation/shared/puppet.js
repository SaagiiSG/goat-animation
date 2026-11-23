// The paper-cut narrators: puppets of thick card parts, each layer shading the one under it, with brass pins at the
// shoulders and elbows. About 11 units tall with the feet on y = 0. A figure (see parts.js) picks the hair, glasses,
// face, clothes and colours; the rig is the same for everyone. Every frame is a function of t and the state passed
// in, so renders repeat exactly.
import * as THREE from "three";
import { FIGURE_DEFAULTS } from "./parts.js";

// a fixed-seed random, so the paper grain is the same every render
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function grain() {
  if (typeof document === "undefined") return null; // Node (tests): no canvas, plain colour
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d"), r = rng(5), img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 236 + (r() - 0.5) * 14;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 60; k++) { // fibres: short curved strokes, a little lighter or darker than the sheet
    const x = r() * 256, y = r() * 256, a = r() * Math.PI * 2, l = 6 + r() * 18;
    g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,0.55)" : "rgba(120,110,100,0.18)";
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.45, 0.45);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const V = (x, y) => new THREE.Vector2(x, y);
const D = Math.PI / 180;
// a smooth closed outline through the given points
const blob = (pts, n = 72) =>
  new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, "centripetal").getSpacedPoints(n).slice(0, -1).map((p) => V(p.x, p.y));
const oval = (cx, cy, rx, ry, n = 40) => Array.from({ length: n }, (_, i) => V(cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)));
const rrect = (cx, cy, w, h, r = Math.min(w, h) / 2, n = 10) => { // a rounded rectangle; r = half the short side is a capsule
  const pts = [], x = w / 2 - r, y = h / 2 - r;
  [[x, y, 0], [-x, y, 1], [-x, -y, 2], [x, -y, 3]].forEach(([ox, oy, q]) => {
    for (let i = 0; i <= n; i++) {
      const a = ((q + i / n) * Math.PI) / 2;
      pts.push(V(cx + ox + r * Math.cos(a), cy + oy + r * Math.sin(a)));
    }
  });
  return pts;
};
const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
const flipV = (pts) => pts.map((p) => V(-p.x, p.y)).reverse();
// a closed outline moved in (d < 0) or out along its normals
function offset(poly, d) {
  const s = THREE.ShapeUtils.area(poly) > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
    const nx = (b.y - a.y) * s, ny = -(b.x - a.x) * s, l = Math.hypot(nx, ny) || 1;
    return V(p.x + (nx / l) * d, p.y + (ny / l) * d);
  });
}
// a frame: the outline with its inside cut out, w thick (glasses rims)
const ring = (poly, w) => {
  const s = new THREE.Shape(poly);
  s.holes.push(new THREE.Path(offset(poly, -w)));
  return s;
};
// curls: a round bump between each pair of points, bulging to the left of the way the points run (so outward on a
// clockwise outline); bulge is the bump's height over its width, k varies it bump by bump
function scallop(pts, bulge, k = 0, n = 8) {
  const out = [];
  pts.forEach(([ax, ay], i) => {
    if (i + 1 >= pts.length) return out.push(V(ax, ay));
    const [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, h = bulge * (1 + k * (hash(i * 3.7 + ax) - 0.5));
    for (let j = 0; j < n; j++) {
      const f = j / n, bump = Math.sin(Math.PI * f) * h;
      out.push(V(ax + dx * f - dy * bump, ay + dy * f + dx * bump));
    }
  });
  return out;
}
// points round an ellipse from angle a0 to a1 (radians), n steps
const arcPts = (cx, cy, rx, ry, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
// a curved strip along an arc (a curl's highlight, a crew collar); angles in degrees
const band = (cx, cy, r, w, a0, a1, n = 24) =>
  [...arcPts(cx, cy, r + w / 2, r + w / 2, a0 * D, a1 * D, n), ...arcPts(cx, cy, r - w / 2, r - w / 2, a1 * D, a0 * D, n)].map(([x, y]) => V(x, y));

// Hair, in the head's own space (chin at y = 0, eyes at 1.8, crown at 3.5). back: behind the head; front: over the
// forehead (and down the face for long hair); hi: lighter strokes on top [x, y, r, from°, to°]; ties: in the lighter
// colour; ears: whether the ears show.
const SHORT_BACK = [[-1.72, 1.7], [-1.82, 2.7], [-1.3, 3.62], [0, 3.92], [1.3, 3.62], [1.82, 2.7], [1.72, 1.7], [1.2, 2.2], [-1.2, 2.2]];
const CAP = [[-1.66, 2.1], [-1.7, 2.85], [-1.22, 3.6], [0, 3.84], [1.22, 3.6], [1.7, 2.85], [1.66, 2.1], [1.1, 2.4], [-1.1, 2.4]];
const SWEPT = [[-1.58, 2.3], [-1.48, 3.1], [-0.85, 3.58], [0.1, 3.7], [1.0, 3.52], [1.55, 3.0], [1.58, 2.3], [1.3, 2.72], [0.7, 3.02], [0, 3.08],
  [-0.7, 3.02], [-1.3, 2.72]];
const CURTAIN = [[0.06, 3.5], [0.8, 3.48], [1.48, 3.05], [1.76, 2.0], [1.82, 0.6], [1.85, -0.8], [1.72, -1.8], [1.45, -2.0], [1.38, -1.0], [1.36, 0.2],
  [1.3, 1.4], [1.15, 2.45], [0.7, 3.05], [0.2, 3.25]];
const HAIR = {
  "curly-top": () => ({ ears: true, // curls piled high on top, short at the sides
    back: [[...scallop(arcPts(0, 2.6, 1.7, 1.55, 200 * D, -20 * D, 12), 0.42, 0.5), V(1.2, 2.1), V(-1.2, 2.1)]],
    front: [[...scallop(arcPts(0, 2.62, 1.56, 1.38, 195 * D, -15 * D, 10), 0.32, 0.6),
      ...scallop([[1.52, 2.25], [1.15, 2.8], [0.62, 2.86], [0.1, 2.8], [-0.42, 2.9], [-0.95, 2.82], [-1.36, 2.6], [-1.52, 2.25]], 0.5, 0.5)]],
    hi: [[-0.95, 3.35, 0.2, 30, 250], [-0.25, 3.72, 0.22, 10, 220], [0.55, 3.62, 0.2, -20, 200], [1.12, 3.15, 0.18, 0, 230], [-1.3, 2.95, 0.16, 40, 260],
      [0.1, 3.2, 0.17, 160, 380]] }),
  "curly-mop": () => ({ ears: false, // a messy chin-length mop, locks falling down both sides of the face
    back: [[...scallop(arcPts(0, 2.05, 2.02, 2.12, 236 * D, -56 * D, 14), 0.4, 0.9), V(0.9, 1.0), V(-0.9, 1.0)]],
    front: [[...scallop(arcPts(0, 2.45, 1.76, 1.62, 200 * D, -20 * D, 11), 0.34, 0.9),
      ...scallop([[1.66, 1.95], [1.62, 1.4], [1.36, 0.92], [1.14, 1.5], [1.02, 2.25], [0.55, 2.62], [0.04, 2.5], [-0.45, 2.68], [-0.96, 2.3],
        [-1.13, 1.5], [-1.37, 0.92], [-1.62, 1.4], [-1.66, 1.95]], 0.3, 0.8)]],
    hi: [[-0.85, 3.45, 0.24, 20, 200], [0.2, 3.78, 0.22, 200, 380], [1.0, 3.3, 0.22, -10, 190], [-1.45, 2.4, 0.2, 60, 260], [1.45, 2.3, 0.2, -80, 120]] }),
  short: () => ({ ears: true, back: [blob(SHORT_BACK, 64)],
    front: [blob([[-1.56, 2.3], [-1.45, 3.12], [-0.8, 3.56], [0.2, 3.63], [1.1, 3.42], [1.56, 2.78], [1.5, 2.2], [1.15, 2.62], [0.62, 2.88],
      [0.12, 2.56], [-0.36, 2.88], [-0.9, 2.76], [-1.3, 2.42]], 96)] }),
  "side-part": () => ({ ears: true, back: [blob(SHORT_BACK, 64)], // combed over from a part on the viewer's left
    front: [blob([[-0.72, 3.5], [-0.2, 3.72], [0.6, 3.66], [1.3, 3.3], [1.62, 2.7], [1.6, 2.2], [1.35, 2.55], [0.9, 2.95], [0.3, 3.12], [-0.3, 3.28]], 80),
      blob([[-0.84, 3.48], [-1.35, 3.2], [-1.62, 2.6], [-1.6, 2.15], [-1.36, 2.55], [-1.06, 3.0]], 48)] }),
  buzz: () => ({ ears: true, buzz: true, // cut close: the front is the hair colour mixed into the skin
    back: [blob([[-1.62, 2.1], [-1.62, 2.85], [-1.2, 3.5], [0, 3.62], [1.2, 3.5], [1.62, 2.85], [1.62, 2.1], [1.1, 2.4], [-1.1, 2.4]], 64)],
    front: [blob([[-1.48, 2.6], [-1.3, 3.1], [-0.7, 3.4], [0, 3.5], [0.7, 3.4], [1.3, 3.1], [1.48, 2.6], [1.0, 2.92], [0, 3.0], [-1.0, 2.92]], 64)] }),
  bald: () => ({ ears: true, back: [], front: [], shine: true }),
  long: () => ({ ears: false, // past the shoulders, parted in the middle, falling in front of the shoulders
    back: [blob([[-1.72, 2.2], [-1.78, 3.0], [-1.25, 3.72], [0, 3.95], [1.25, 3.72], [1.78, 3.0], [1.72, 2.2], [1.9, 0.8], [2.0, -0.8], [1.85, -2.0],
      [1.4, -2.45], [0.5, -2.5], [-0.5, -2.5], [-1.4, -2.45], [-1.85, -2.0], [-2.0, -0.8], [-1.9, 0.8]], 96)],
    front: [blob(CURTAIN, 96), blob(mirror(CURTAIN), 96)] }),
  bob: () => ({ ears: false, // chin length, blunt bangs
    back: [blob([[-1.72, 2.2], [-1.8, 3.0], [-1.25, 3.72], [0, 3.95], [1.25, 3.72], [1.8, 3.0], [1.72, 2.2], [1.88, 1.0], [1.9, 0.25], [1.6, 0.05],
      [0.9, 0.1], [-0.9, 0.1], [-1.6, 0.05], [-1.9, 0.25], [-1.88, 1.0]], 96)],
    front: [blob([[-1.7, 2.3], [-1.55, 3.15], [-0.85, 3.66], [0, 3.78], [0.85, 3.66], [1.55, 3.15], [1.7, 2.3], [1.85, 1.2], [1.88, 0.3], [1.62, 0.1],
      [1.36, 0.22], [1.3, 1.2], [1.25, 2.0], [1.15, 2.45], [0.6, 2.5], [0, 2.5], [-0.6, 2.5], [-1.15, 2.45], [-1.25, 2.0], [-1.3, 1.2], [-1.36, 0.22],
      [-1.62, 0.1], [-1.88, 0.3], [-1.85, 1.2]], 120)] }),
  ponytail: () => ({ ears: true, // pulled back, the tail showing on the viewer's right
    back: [blob(CAP, 64), blob([[1.25, 3.3], [1.85, 3.05], [2.15, 2.3], [2.25, 1.3], [2.15, 0.3], [1.9, -0.4], [1.75, 0.4], [1.72, 1.4], [1.6, 2.3], [1.3, 2.9]], 64)],
    front: [blob(SWEPT, 80)], ties: [rrect(1.72, 3.1, 0.22, 0.34, 0.08)] }),
  bun: () => ({ ears: true, back: [blob(CAP, 64), oval(0, 4.12, 0.64, 0.56)], front: [blob(SWEPT, 80)], ties: [rrect(0, 3.64, 0.74, 0.16)] }),
};

const shade = (hex, dl) => "#" + new THREE.Color(hex).offsetHSL(0, 0, dl).getHexString();
const mix = (a, b, f) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), f).getHexString();
const light = (hex) => new THREE.Color(hex).getHSL({}).l;

// fig: a checked figure (parts.js checkFigure); missing fields take the defaults
export function makePuppet(fig = {}) {
  const F = { ...FIGURE_DEFAULTS, ...fig };
  const dark = light(F.topColor) < 0.3, H = HAIR[F.hair]();
  const C = {
    skin: F.skin, skinDark: shade(F.skin, -0.08), skinLight: shade(F.skin, 0.07), cheek: mix(F.skin, "#E8846F", 0.35),
    hair: F.hairColor, hairHi: shade(F.hairColor, 0.12), top: F.topColor, topDark: shade(F.topColor, dark ? 0.07 : -0.1),
    string: shade(F.topColor, dark ? 0.15 : -0.2), pants: F.pants, shoe: F.shoes, sole: light(F.shoes) > 0.6 ? shade(F.shoes, -0.14) : shade(F.shoes, 0.15),
    ink: "#1A1A1A", mouth: "#6E1F2A", tongue: "#DD6B66", white: "#FBF8F2", brass: "#E2BC62", silver: "#C9CED4",
  };
  const tex = grain(), GAP = 0.34, mats = {};
  const mat = (color) => (mats[color] ??= new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.95, metalness: 0 }));
  const edgeMat = new THREE.MeshStandardMaterial({ color: C.white, roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.2, roughness: 0.15, depthWrite: false });

  // one card part: its outline (or a Shape with holes), colour and layer (higher is nearer the viewer); fine parts
  // (face features, strings, trims) are cut from thinner card
  const part = (poly, color, layer, fine = false) => {
    const geo = new THREE.ExtrudeGeometry(poly instanceof THREE.Shape ? poly : new THREE.Shape(poly), { depth: fine ? 0.06 : 0.14, bevelEnabled: false, curveSegments: 4 });
    const m = new THREE.Mesh(geo, [mat(color), edgeMat]);
    m.position.z = layer * GAP;
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const pane = (poly, layer) => { // a glasses lens: clear, with a faint shine
    const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(poly)), glass);
    m.position.z = layer * GAP + 0.07;
    return m;
  };
  const pivot = (x, y, parent) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    parent.add(p);
    return p;
  };
  const pin = (x, y, layer, parent) => { // a brass paper fastener on a joint
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.3, metalness: 0.25 }));
    m.position.set(x, y, layer * GAP + 0.12);
    m.castShadow = true;
    parent.add(m);
  };

  const root = new THREE.Group();
  // legs and shoes stand still; everything above turns at the hips
  const LEG = [[-1.25, 0.45], [-0.08, 0.45], [-0.05, 3.5], [-0.7, 3.62], [-1.32, 3.5]];
  root.add(part(blob(LEG, 40), C.pants, 1), part(blob(mirror(LEG), 40), C.pants, 1));
  const SHOE = [[-1.5, 0.05], [-0.7, 0], [0.05, 0.05], [0.08, 0.4], [-0.3, 0.66], [-1.15, 0.68], [-1.55, 0.38]];
  root.add(part(blob(SHOE, 48), C.shoe, 1.5), part(blob(mirror(SHOE), 48), C.shoe, 1.5));
  root.add(part(rrect(-0.72, 0.08, 1.6, 0.16), C.sole, 1.6, true), part(rrect(0.72, 0.08, 1.6, 0.16), C.sole, 1.6, true));

  // the top: crew and tee dip in front so the neck shows above the collar; a shirt opens in a V; a hoodie's hood sits
  // round the neck instead
  const hips = pivot(0, 3.5, root);
  const neckline = { crew: [[0.62, 3.2], [0, 2.92], [-0.62, 3.2]], tee: [[0.62, 3.2], [0, 2.92], [-0.62, 3.2]], shirt: [[0.5, 3.22], [0, 2.78], [-0.5, 3.22]],
    hoodie: [[0.6, 3.18], [-0.6, 3.18]] }[F.top];
  hips.add(part(blob([[-1.5, -0.42], [-0.9, -0.46], [0.9, -0.46], [1.5, -0.42], [1.58, 1.0], [1.64, 2.3], [1.42, 2.95], ...neckline,
    [-1.42, 2.95], [-1.64, 2.3], [-1.58, 1.0]], 80), C.top, 3));
  if (F.top !== "shirt") hips.add(part(rrect(0, -0.26, 3.0, 0.36), C.topDark, 3.4, true));
  const neck = pivot(0, 3.0, hips);
  neck.add(part(rrect(0, 0.2, 0.78, 1.2), C.skinDark, 2.5));
  if (F.top === "crew" || F.top === "tee") hips.add(part(band(0, 3.47, 0.6, 0.18, 198, 342), C.topDark, 3.5, true));
  if (F.top === "shirt") {
    const COLLAR = [[0.04, 2.84], [0.62, 3.34], [0.86, 3.12], [0.46, 2.66]];
    hips.add(part(blob(COLLAR, 32), C.topDark, 3.6, true), part(blob(mirror(COLLAR), 32), C.topDark, 3.6, true));
    hips.add(part(rrect(0, 1.25, 0.12, 2.9), C.topDark, 3.4, true));
    [0.3, 1.1, 1.9].forEach((y) => hips.add(part(oval(0, y, 0.07, 0.07, 14), C.white, 3.5, true)));
  }
  if (F.top === "hoodie") {
    hips.add(part(blob([[-0.95, 0.12], [0, 0.08], [0.95, 0.12], [0.82, 1.18], [0, 1.22], [-0.82, 1.18]], 48), C.topDark, 3.4, true));
    [-0.3, 0.3].forEach((x) => hips.add(part(rrect(x, 1.95, 0.1, 1.0), C.string, 3.7, true), part(rrect(x, 1.42, 0.14, 0.2), C.silver, 3.75, true)));
    hips.add(part(blob([[-1.12, 3.2], [-0.8, 2.5], [0, 2.26], [0.8, 2.5], [1.12, 3.2], [0.55, 3.42], [-0.55, 3.42]], 48), C.topDark, 3.6, true));
  }

  const head = pivot(0, 0.5, neck);
  for (const p of H.back) head.add(part(p, C.hair, 0));
  for (const p of H.ties ?? []) head.add(part(p, C.hairHi, 0.3, true));
  const EAR = [[1.33, 1.35], [1.72, 1.42], [1.86, 1.84], [1.7, 2.22], [1.38, 2.15]];
  if (H.ears) head.add(part(blob(EAR, 32), C.skin, 2), part(blob(mirror(EAR), 32), C.skin, 2));
  head.add(part(blob([[0, -0.08], [0.88, 0.24], [1.46, 1.1], [1.6, 2.0], [1.36, 2.9], [0.72, 3.36], [0, 3.46], [-0.72, 3.36], [-1.36, 2.9], [-1.6, 2.0],
    [-1.46, 1.1], [-0.88, 0.24]], 96), C.skin, 4));
  if (H.shine) head.add(part(band(0.55, 2.95, 0.32, 0.09, 40, 115), C.skinLight, 4.2, true));
  head.add(part(oval(-1.0, 1.05, 0.3, 0.24), C.cheek, 4.3, true), part(oval(1.0, 1.05, 0.3, 0.24), C.cheek, 4.3, true));
  head.add(part(blob([[0, 1.62], [0.17, 1.28], [0.02, 1.18], [-0.15, 1.27]], 24), C.skinDark, 4.4, true));
  const eyes = [-0.6, 0.6].map((x) => {
    const e = pivot(x, 1.78, head);
    e.add(part(oval(0, 0, 0.19, 0.25), C.ink, 4.5, true), part(oval(0.06, 0.08, 0.055, 0.055, 16), C.white, 4.6, true));
    return e;
  });
  // the face: stubble and a beard follow the jaw; a mustache sits over the mouth
  const JAW = [[-1.5, 1.55], [-1.45, 0.95], [-0.95, 0.2], [0, -0.22], [0.95, 0.2], [1.45, 0.95], [1.5, 1.55], [1.2, 1.1], [0.7, 0.4], [0.4, 0.2],
    [0, 0.1], [-0.4, 0.2], [-0.7, 0.4], [-1.2, 1.1]];
  const MUST = [[-0.44, 0.97], [0, 1.07], [0.44, 0.97], [0.4, 0.9], [0, 0.98], [-0.4, 0.9]];
  const stub = mix(F.skin, F.hairColor, 0.22);
  if (F.face === "stubble") head.add(part(blob(JAW, 80), stub, 4.35, true), part(blob(MUST, 40), stub, 4.35, true));
  if (F.face === "beard") head.add(part(blob(JAW, 80), C.hair, 4.55, true));
  if (F.face === "mustache" || F.face === "goatee" || F.face === "beard") head.add(part(blob(MUST, 40), C.hair, 4.55, true));
  if (F.face === "goatee") head.add(part(blob([[-0.2, 0.3], [0.2, 0.3], [0.17, 0.02], [0, -0.16], [-0.17, 0.02]], 32), C.hair, 4.55, true));
  // glasses
  if (F.glasses === "clear" || F.glasses === "dark") { // thick rectangular frames, clear acetate or black
    const col = F.glasses === "clear" ? "#CDD2D6" : "#1C1C1E", w = F.glasses === "clear" ? 0.09 : 0.08;
    [-0.6, 0.6].forEach((x) => {
      const lens = rrect(x, 1.8, 1.04, 0.76, 0.2);
      head.add(part(ring(lens, w), col, 4.65, true), pane(offset(lens, -w), 4.65));
      head.add(part(rrect(1.3 * Math.sign(x), 1.98, 0.3, 0.06), col, 4.62, true));
    });
    head.add(part(rrect(0, 1.9, 0.24, 0.1), col, 4.65, true));
  } else if (F.glasses === "round") { // thin round wire frames
    [-0.6, 0.6].forEach((x) => {
      const lens = oval(x, 1.8, 0.42, 0.4, 48);
      head.add(part(ring(lens, 0.05), "#3A3632", 4.65, true), pane(offset(lens, -0.05), 4.65));
      head.add(part(rrect(1.24 * Math.sign(x), 1.95, 0.4, 0.05), "#3A3632", 4.62, true));
    });
    head.add(part(band(0, 1.82, 0.2, 0.05, 20, 160, 12), "#3A3632", 4.65, true));
  } else if (F.glasses === "aviator") { // thin wire aviators with a double bridge
    const LENS = [[0.16, 2.1], [1.1, 2.11], [1.14, 1.82], [0.98, 1.5], [0.64, 1.42], [0.28, 1.5], [0.14, 1.78]];
    [blob(LENS, 48), flipV(blob(LENS, 48))].forEach((lens) => head.add(part(ring(lens, 0.05), "#4A443C", 4.65, true), pane(offset(lens, -0.05), 4.65)));
    head.add(part(rrect(0, 2.1, 0.36, 0.05), "#4A443C", 4.65, true), part(rrect(0, 1.92, 0.26, 0.05), "#4A443C", 4.65, true));
    [-1, 1].forEach((s) => head.add(part(rrect(1.3 * s, 2.02, 0.36, 0.05), "#4A443C", 4.62, true)));
  }
  for (const p of H.front) head.add(part(p, H.buzz ? mix(F.hairColor, F.skin, 0.35) : C.hair, 4.7));
  for (const [x, y, r, a0, a1] of H.hi ?? []) head.add(part(band(x, y, r, 0.07, a0, a1, 16), C.hairHi, 4.75, true));
  const brows = [-0.6, 0.6].map((x) => {
    const b = pivot(x, 2.32, head);
    b.add(part(rrect(0, 0, 0.64, 0.14), C.hair, 4.8, true));
    return b;
  });
  const mouthAt = pivot(0, 0.72, head), MOUTH = {
    rest: part(blob([[-0.42, 0.08], [0, -0.24], [0.42, 0.08], [0.3, 0.03], [0, -0.1], [-0.3, 0.03]], 40), C.mouth, 4.5, true),
    a: (() => {
      const g = part(blob([[-0.38, 0.1], [0.38, 0.1], [0.3, -0.26], [0, -0.44], [-0.3, -0.26]], 40), C.mouth, 4.5, true);
      g.add(part(oval(0, -0.3, 0.18, 0.09, 20), C.tongue, 0.15, true));
      return g;
    })(),
    o: part(oval(0, -0.1, 0.19, 0.25), C.mouth, 4.5, true),
    e: part(blob([[-0.46, 0.06], [0.46, 0.06], [0.36, -0.16], [0, -0.22], [-0.36, -0.16]], 40), C.mouth, 4.5, true),
    m: part(rrect(0, 0, 0.6, 0.09), C.mouth, 4.5, true),
  };
  Object.values(MOUTH).forEach((m) => mouthAt.add(m));

  // arms: shoulder → upper arm → elbow → forearm → wrist → hand; s = -1 on the viewer's left, 1 on the right. Pushed-up
  // and short sleeves show the forearm; a watch goes on the viewer's-left wrist when the sleeve doesn't cover it.
  const arm = (s) => {
    const sh = pivot(1.36 * s, 2.62, hips);
    if (F.sleeves === "short") sh.add(part(rrect(0, -0.8, 0.72, 1.8), C.skin, 4.9), part(rrect(0, -0.3, 0.92, 1.1, 0.18), C.top, 5));
    else sh.add(part(rrect(0, -0.7, 0.86, 2.0), C.top, 5));
    pin(0, 0, 5, sh);
    const el = pivot(0, -1.45, sh);
    if (F.sleeves === "pushed")
      el.add(part(rrect(0, -0.75, 0.72, 1.6), C.skin, 5.1), part(rrect(0, -0.32, 0.86, 1.04, 0.16), C.top, 5.2), part(rrect(0, -0.84, 0.92, 0.3, 0.1), C.topDark, 5.3, true));
    else if (F.sleeves === "short") el.add(part(rrect(0, -0.72, 0.7, 1.6), C.skin, 5.1));
    else el.add(part(rrect(0, -0.62, 0.8, 1.75), C.top, 5.2), part(rrect(0, -1.42, 0.86, 0.32), C.topDark, 5.3, true));
    if (F.watch && s < 0 && F.sleeves !== "full")
      el.add(part(rrect(0, -1.36, 0.76, 0.2), C.silver, 5.35, true), part(rrect(0, -1.36, 0.3, 0.3, 0.08), "#E6E9EC", 5.4, true));
    if (F.sleeves !== "short") pin(0, 0, 5.2, el);
    const wr = pivot(0, -1.55, el);
    const MIT = [[-0.36, 0.12], [0.36, 0.12], [0.43, -0.35], [0.3, -0.76], [0, -0.86], [-0.3, -0.73], [-0.43, -0.35]];
    const THUMB = [[-0.25, -0.05], [-0.62, -0.18], [-0.66, -0.44], [-0.36, -0.46]];
    wr.add(part(blob(s > 0 ? MIT : mirror(MIT), 40), C.skin, 5.45), part(blob(s > 0 ? THUMB : mirror(THUMB), 24), C.skin, 5.42));
    return { sh, el, wr, s };
  };
  const ARMS = [arm(-1), arm(1)];

  // state: { mouth: "rest"|"a"|"o"|"e"|"m", blink 0…1, brow 0…1 (raised), tilt (rad), point 0…1 (the arm on the
  // `toward` side, -1 left or 1 right, presents the stage), think 0…1 (the other hand goes to the chin), wave 0…1
  // (the other hand waves) }
  function pose(t, s = {}) {
    const sway = Math.sin(2 * Math.PI * 0.31 * t), sway2 = Math.sin(2 * Math.PI * 0.53 * t + 1.1);
    const open = s.mouth === "a" || s.mouth === "o" ? 1 : s.mouth === "e" ? 0.5 : 0;
    hips.rotation.z = 0.025 * sway;
    neck.rotation.z = 0.035 * sway2 + (s.tilt ?? 0);
    head.position.y = 0.5 + 0.05 * open;
    head.rotation.z = 0.02 * Math.sin(2 * Math.PI * 0.9 * t) * open;
    eyes.forEach((e) => (e.scale.y = Math.max(0.08, 1 - (s.blink ?? 0))));
    const brow = s.brow ?? 0;
    brows.forEach((b, i) => {
      b.position.y = 2.32 + 0.2 * brow;
      b.rotation.z = (i ? -1 : 1) * (0.06 + 0.1 * brow);
    });
    for (const [k, m] of Object.entries(MOUTH)) m.visible = k === (s.mouth ?? "rest");
    const toward = s.toward ?? -1;
    for (const A of ARMS) {
      const lead = A.s === toward, p = lead ? s.point ?? 0 : 0, th = lead ? 0 : s.think ?? 0, w = lead ? 0 : s.wave ?? 0;
      A.sh.rotation.z = A.s * (0.14 + 0.03 * (A.s < 0 ? sway : sway2) + 1.25 * p - 0.55 * th + 2.3 * w);
      A.el.rotation.z = A.s * (0.12 - 0.55 * p - 2.75 * th + (0.6 + 0.35 * Math.sin(2 * Math.PI * 2.2 * t)) * w);
      A.wr.rotation.z = A.s * (-0.3 * p + 0.35 * th);
    }
  }
  pose(0);
  return { root, pose, head };
}

// Which mouth shape a word shows at time t: letters spread evenly over the word, vowels open, m/b/p close.
const SHAPE = { a: "a", i: "e", e: "e", y: "e", o: "o", u: "o", m: "m", b: "m", p: "m", а: "a", э: "e", и: "e", ы: "e", е: "e", о: "o",
  ө: "o", у: "o", ү: "o", ю: "o", я: "a", м: "m", б: "m", п: "m" };
export function mouthAt(words, t) {
  const w = words.find((x) => t >= x.start && t < x.end);
  if (!w) return "rest";
  const letters = [...w.text.toLowerCase()].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return "rest";
  const c = letters[Math.min(letters.length - 1, Math.floor(((t - w.start) / (w.end - w.start)) * letters.length))];
  return SHAPE[c] ?? "e";
}

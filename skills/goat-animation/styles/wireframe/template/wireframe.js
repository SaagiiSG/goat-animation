// Wireframe: every object is cut into the same number of line pieces, so one can turn into the next on its word.
import * as THREE from "three";
import { LineSegments2 } from "./shared/three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./shared/three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./shared/three/addons/lines/LineMaterial.js";
import { EffectComposer } from "./shared/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./shared/three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./shared/three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./shared/three/addons/postprocessing/OutputPass.js";
import { OBJECTS } from "./shared/objects.js";
import { fitParams, applyFit, resample, zorder, morphStagger, morphK, ease, LAYOUT } from "./shared/lines.js";
import { captionDrawer } from "./shared/captions.js";

const P = window.PLAN, N = 2000, NA = 400; // line pieces for morphs: white, and the accent colour's own
const cat = (...fs) => {
  const out = new Float32Array(fs.reduce((s, f) => s + f.length, 0));
  let at = 0;
  for (const f of fs) out.set(f, at), (at += f.length);
  return out;
};
const clamp = (v) => Math.min(1, Math.max(0, v));

// Each beat's object, built once: every part's own edges (in the part's space), its act(t), and the fit taken from
// its rest pose (t = 0). pose(t) moves the parts and returns the fitted segments, so an object can act out its idea
// while it holds. A beat with "count" shows that many copies, each a little out of step, laid out in rows; the group is
// up to 1.3 wide (728 px) and 1.0 tall (560 px), so two rows stay clear of the captions.
const key = (b) => `${b.object}:${b.count ?? 1}`;
const inst = {};
function build(b) {
  const id = key(b);
  if (inst[id]) return inst[id];
  const n = b.count ?? 1, copiesG = Array.from({ length: n }, () => OBJECTS[b.object]()), U = copiesG[0].userData;
  const isHot = (o) => {
    for (let x = o; x; x = x.parent) if (x.userData.accent) return true;
    return false;
  };
  const parts = copiesG.map((g) => {
    const list = [];
    g.traverse((o) => {
      const pos = o.isMesh ? new THREE.EdgesGeometry(o.geometry, 20).attributes.position : o.isLineSegments ? o.geometry.attributes.position : null;
      if (pos) list.push({ o, local: Float32Array.from(pos.array), hot: isHot(o) });
    });
    return list;
  });
  // copy c at act time t: its white segments, its accent segments, and its anchor, in its own space
  const raw = (c, t) => {
    const g = copiesG[c];
    g.userData.act?.(t + c * 0.37);
    g.updateMatrixWorld(true);
    const w = [], a = [];
    for (const { o, local, hot } of parts[c]) {
      const e = o.matrixWorld.elements, out = hot ? a : w;
      for (let i = 0; i < local.length; i += 3) {
        const x = local[i], y = local[i + 1], z = local[i + 2];
        out.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      }
    }
    const an = new THREE.Vector3(...(g.userData.anchor ?? [0, 0, 0])).applyMatrix4(g.matrixWorld);
    return { w: new Float32Array(w), a: new Float32Array(a), an: new Float32Array([an.x, an.y, an.z, an.x, an.y, an.z]) };
  };
  const r0 = raw(0, 0), one = fitParams(cat(r0.w, r0.a, r0.an), U.size ?? 1.0);
  const shift = (f, d) => f.map((v, i) => v + d[i % 3]);
  const laid = (t) => { // every copy fitted to its size and moved to its place in the rows
    const all = copiesG.map((_, c) => {
      const r = raw(c, t), d = n > 1 ? LAYOUT[n][c] : [0, 0, 0];
      return { w: shift(applyFit(r.w, one), d), a: shift(applyFit(r.a, one), d), an: shift(applyFit(r.an, one), d) };
    });
    return { w: cat(...all.map((x) => x.w)), a: cat(...all.map((x) => x.a)), an: all[0].an };
  };
  const l0 = laid(0), rows = n > 1 ? fitParams(cat(l0.w, l0.a), 1.3, 1.0) : null;
  const pose = (t) => {
    const l = laid(t), f = (x) => (rows ? applyFit(x, rows) : x), an = f(l.an);
    return { w: f(l.w), a: f(l.a), anchor: new THREE.Vector3(an[0], an[1], an[2]) };
  };
  const rest = pose(0), all = cat(rest.w, rest.a);
  let maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < all.length; i += 3) (maxX = Math.max(maxX, all[i])), (maxY = Math.max(maxY, all[i + 1]));
  const geo = (len) => new LineSegmentsGeometry().setPositions(new Float32Array(Math.max(6, len)));
  return (inst[id] = {
    pose, front: !!U.front, corner: new THREE.Vector3(maxX, maxY, 0),
    pieces: { w: zorder(resample(rest.w, N)), a: zorder(resample(rest.a, NA)) },
    hold: { w: geo(rest.w.length), a: geo(rest.a.length) },
  });
}
P.beats.forEach(build);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("stage"), antialias: true, preserveDrawingBuffer: true });
// software drawing (no graphics chip) makes the glow very slow, so it falls back to the light look by itself
const gl = renderer.getContext(), info = gl.getExtension("WEBGL_debug_renderer_info");
const FULL = P.quality !== "light" && !(info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
// 1.0 world unit is about 560 px tall at this distance; y 0.36 puts the object's centre at about y 760 on screen
const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 50);
camera.position.set(0, 0, 6.4);
const Y0 = 0.36;
const DIST = 0.5; // how far the camera glides in while an object holds

// its own buffer: setPositions keeps the array it is given, and morphs write into it every frame
// the space: a faint floor grid that drifts toward the viewer and fades into the dark, and slow dust, so the objects
// hang in a room instead of on flat black. Dust positions come from a fixed seed, so every render is the same.
// The grid is cut cell by cell so a ring of light can run across it when an object lands.
scene.fog = new THREE.Fog(0x000000, 8, 19);
const CELL = 0.5, floorPts = [];
for (let x = -8; x <= 8 + 1e-6; x += CELL) for (let z = -16; z < 4 - 1e-6; z += CELL) floorPts.push(x, 0, z, x, 0, z + CELL);
for (let z = -16; z <= 4 + 1e-6; z += CELL) for (let x = -8; x < 8 - 1e-6; x += CELL) floorPts.push(x, 0, z, x + CELL, 0, z);
const floorGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(floorPts, 3))
  .setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(floorPts.length).fill(0.16), 3));
const floor = new THREE.LineSegments(floorGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
floor.position.y = -0.9;
scene.add(floor);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const DUST = Array.from({ length: 160 }, () => [rand() * 8 - 4, rand() * 3.9 - 0.9, rand() * 13 - 10]);
const dustGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(DUST.flat(), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, transparent: true, opacity: 0.35 }));
scene.add(dust);

// two layers, white and the brand's accent colour, each with its own still lines and morph pieces
const lineMat = (color, extra = {}) => {
  const m = new LineMaterial({ color, linewidth: FULL ? 2.2 : 3.0, worldUnits: false, ...extra });
  m.resolution.set(1080, 1920);
  return m;
};
const ACCENT = new THREE.Color(P.brand.accent);
const layer = (nPieces, mat) => {
  const geom = new LineSegmentsGeometry().setPositions(new Float32Array(nPieces * 6));
  const morphing = new LineSegments2(geom, mat), still = new LineSegments2(inst[key(P.beats[0])].hold.w, mat);
  morphing.frustumCulled = still.frustumCulled = false;
  return { geom, morphing, still };
};
const L = { w: layer(N, lineMat(0xffffff)), a: layer(NA, lineMat(ACCENT)) };
const obj = new THREE.Group();
obj.add(L.w.morphing, L.w.still, L.a.morphing, L.a.still);
scene.add(obj);

// a burst of short accent sparks flies out from the object as it lands
const SPARKS = Array.from({ length: 28 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 28, r = Math.sqrt(1 - y * y), th = i * 2.39996;
  return [r * Math.cos(th), y * 0.8, r * Math.sin(th)];
});
const sparkGeo = new LineSegmentsGeometry().setPositions(new Float32Array(SPARKS.length * 6));
const sparkMat = lineMat(ACCENT, { transparent: true });
const sparks = new LineSegments2(sparkGeo, sparkMat);
sparks.frustumCulled = false;
sparks.position.y = Y0;
scene.add(sparks);

let composer = null, bloom = null;
if (FULL) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass((bloom = new UnrealBloomPass(new THREE.Vector2(1080, 1920), 0.55, 0.05, 0.1)));
  composer.addPass(new OutputPass());
}

const drawCaption = captionDrawer(document.getElementById("cap"), P);
const cta = document.getElementById("cta"), term = document.getElementById("term"), tag = document.getElementById("tag");
cta.style.color = P.brand.accentOnDark;
document.documentElement.style.setProperty("--accent", P.brand.accent);
document.documentElement.style.setProperty("--accent-text", P.brand.accentOnDark);
const toScreen = (v) => {
  const s = v.clone().applyMatrix4(obj.matrixWorld).project(camera);
  return [((s.x + 1) / 2) * 1080, ((1 - s.y) / 2) * 1920];
};
function renderAt(t) {
  const B = P.beats;
  let i = 0;
  for (let k = 1; k < B.length; k++) if (t >= B[k].t - 0.4) i = k;
  const k = i ? morphK(t, B[i].t) : 1, cur = B[i].object, I = inst[key(B[i])];
  const acting = (b) => Math.max(0, t - (b.t + 0.1)); // seconds since a beat's object landed whole
  const hold = !i || k >= 1 ? B[i] : k <= 0 ? B[i - 1] : null;
  let anchor = null;
  for (const c of ["w", "a"]) (L[c].morphing.visible = !hold), (L[c].still.visible = !!hold);
  if (hold) {
    const h = inst[key(hold)], p = h.pose(acting(hold));
    for (const c of ["w", "a"]) {
      L[c].still.geometry = h.hold[c];
      const buf = h.hold[c].attributes.instanceStart.data;
      buf.array.set(p[c]);
      buf.needsUpdate = true;
    }
    anchor = p.anchor;
  } else {
    // the last object, as it is acting right now, breaks into pieces that swirl into the new one in a wave
    const from = inst[key(B[i - 1])].pose(acting(B[i - 1]));
    for (const [c, n] of [["w", N], ["a", NA]]) {
      const buf = L[c].geom.attributes.instanceStart.data;
      buf.array.set(morphStagger(zorder(resample(from[c], n)), I.pieces[c], k));
      buf.needsUpdate = true;
    }
  }

  // each object arrives at the same three-quarter view and turns a little, slowing down, so none ends up edge-on;
  // the turn blends across a morph, and the comment box turns to face the viewer so the word can be typed in
  const spin = (dt) => -0.55 + 1.1 * (1 - Math.exp(-Math.max(0, dt) / 8));
  let ry = spin(t - B[i].t);
  if (i && k < 1) ry = spin(t - B[i - 1].t) + (ry - spin(t - B[i - 1].t)) * k;
  const front = I.front ? k : 0;
  obj.rotation.set(0.32 * (1 - front), ry * (1 - front), 0);
  // it lands with a small springy pop
  const d = t - (B[i].t + 0.1), pop = i && d > 0 ? 0.07 * Math.exp(-6 * d) * Math.sin(10 * d) : 0;
  obj.scale.setScalar(1 + pop);
  obj.position.y = Y0 + 0.01 * Math.sin(2 * Math.PI * 0.4 * t);
  obj.updateMatrixWorld(true);

  // the camera never sits still: it glides in while an object holds, pulls back as the next one forms, and drifts
  const glide = (dt) => 6.4 + DIST / 2 - DIST * (1 - Math.exp(-Math.max(0, dt) / 2.2));
  let cz = glide(t - B[i].t);
  if (i && k < 1) cz = glide(t - B[i - 1].t) + (cz - glide(t - B[i - 1].t)) * k;
  camera.position.set(0.2 * Math.sin(0.31 * t), 0.06 * Math.sin(0.47 * t + 1), cz);
  camera.lookAt(0, 0, 0);

  // the glow flares as the object lands, and a ring of light runs out across the floor from under it
  if (bloom) bloom.strength = 0.55 + (i && d > 0 ? 0.4 * Math.exp(-7 * d) : 0) + (i && k > 0 && k < 1 ? 0.25 * Math.sin(Math.PI * k) : 0);
  const fc = floorGeo.attributes.color, fp = floorGeo.attributes.position, ring = i && d > 0 && d < 3 ? 3.2 * d : -9;
  for (let v = 0; v < fp.count; v++) {
    const r = Math.hypot(fp.getX(v), fp.getZ(v) + floor.position.z);
    const glow = ring > 0 ? 0.55 * Math.exp(-((r - ring) ** 2) / 0.08) * Math.exp(-1.2 * d) : 0;
    fc.setXYZ(v, 0.16 + glow, 0.16 + glow, 0.16 + glow);
  }
  fc.needsUpdate = true;

  // sparks: out over 0.6 s after landing, shrinking and fading
  const e = i && d > 0 && d < 0.6 ? d / 0.6 : -1;
  sparks.visible = e >= 0;
  if (e >= 0) {
    const out = 1 - (1 - e) ** 3, r0 = 0.35 + 1.0 * out, len = 0.14 * (1 - e), buf = sparkGeo.attributes.instanceStart.data;
    SPARKS.forEach(([x, y, z], n) => buf.array.set([x * r0, y * r0, z * r0, x * (r0 + len), y * (r0 + len), z * (r0 + len)], n * 6));
    buf.needsUpdate = true;
    sparkMat.opacity = 1 - e;
  }

  if (P.cta && cur === "comment" && t >= P.cta.t && anchor) {
    const [x, y] = toScreen(anchor);
    const n = Math.min(P.cta.word.length, Math.floor((t - P.cta.t) / (2 / 30)));
    cta.textContent = P.cta.word.slice(0, n) + (Math.floor(t * 2) % 2 ? "" : "|");
    cta.style.left = `${x}px`;
    cta.style.top = `${y}px`;
    cta.style.opacity = String(ease(clamp((t - P.cta.t) / 0.2)));
  } else cta.textContent = "";

  // a terminal types its lines while it holds, fast enough to finish before the next beat; "$" and "✓" in the accent
  const landed = hold === B[i] && (!i || k >= 1);
  if (landed && cur === "terminal" && B[i].lines && anchor) {
    const [x, y] = toScreen(anchor), lines = B[i].lines, total = lines.reduce((s, l) => s + [...l].length, 0);
    const until = (B[i + 1] ? B[i + 1].t - 0.4 : P.dur) - (B[i].t + 0.1), rate = total / Math.max(0.6, Math.min(2.5, until * 0.75));
    let left = Math.floor(acting(B[i]) * rate);
    term.replaceChildren(...lines.map((l) => {
      const chars = [...l], shown = chars.slice(0, Math.max(0, left));
      left -= chars.length;
      const row = document.createElement("div");
      shown.forEach((ch, n) => {
        const span = document.createElement("span");
        span.textContent = ch;
        if (n === 0 && (ch === "$" || ch === "✓" || ch === ">")) span.className = "hot";
        row.append(span);
      });
      return row;
    }).filter((row) => row.childNodes.length));
    if (Math.floor(t * 2.5) % 2 === 0) (term.lastChild ?? term.appendChild(document.createElement("div"))).append(Object.assign(document.createElement("span"), { textContent: "▌", className: "hot" }));
    term.style.left = `${x}px`;
    term.style.top = `${y}px`;
  } else term.replaceChildren();

  // a tag pops in by the object's top right corner once it has landed
  if (landed && B[i].tag) {
    const [x, y] = toScreen(I.corner), dt = acting(B[i]), s = Math.min(1.08, 1 - Math.exp(-9 * dt) * Math.cos(12 * dt));
    tag.textContent = B[i].tag;
    tag.style.left = `${Math.min(x - 10, 960 - tag.offsetWidth)}px`;
    tag.style.top = `${Math.max(280, y - 70)}px`;
    tag.style.transform = `scale(${Math.max(0, s).toFixed(3)}) translateY(${(4 * Math.sin(2 * Math.PI * 0.5 * t)).toFixed(2)}px)`;
    tag.style.display = "block";
  } else tag.style.display = "none";

  floor.position.z = (t * 0.25) % CELL;
  const dp = dustGeo.attributes.position;
  DUST.forEach(([x, y, z], n) => dp.setXYZ(n, x, -0.9 + ((y + 0.9 + 0.06 * t) % 3.9), z));
  dp.needsUpdate = true;

  drawCaption(t);
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

window.__renderAt = renderAt;
renderAt(window.__lastT || 0);
window.__threeReady();

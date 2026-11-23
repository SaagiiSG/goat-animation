// Stage: one solid object per idea on a round plinth, under a spotlight, with a paper-cut narrator standing beside it.
// The stage turns from warm paper to deep navy at the plan's turn ("but here's the catch") and back if it says so.
import * as THREE from "three";
import { OBJECTS } from "./shared/objects.js";
import { soften } from "./shared/soft.js";
import { makePuppet, mouthAt } from "./shared/puppet.js";
import { captionDrawer } from "./shared/captions.js";

const P = window.PLAN, B = P.brand;
const clamp = (v) => Math.min(1, Math.max(0, v));
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const springIn = (x) => (x <= 0 ? 0 : 1 - Math.exp(-7 * x) * Math.cos(11 * x));

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("stage"), antialias: true, preserveDrawingBuffer: true });
const gl = renderer.getContext(), info = gl.getExtension("WEBGL_debug_renderer_info");
const FULL = P.quality !== "light" && !(info && /swiftshader|llvmpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = FULL ? THREE.VSMShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.1, 100);
// one narrator stands right of the plinth; two stand either side of it
const DUO = (P.narrators?.length ?? 1) > 1;
const AIM = new THREE.Vector3(0, 0.2, 0), PX = DUO ? 0 : -0.3, PR = DUO ? 0.8 : 1.05; // plinth x and radius

// the two moods the stage moves between
const MOOD = [
  { stage: B.paper, hemiSky: "#fff8ee", hemiGround: "#d6cfc4", hemi: 1.15, spot: "#fff1de", spotI: 2.4, angle: 0.62, rim: 0.5, ink: B.ink, accentText: B.accent },
  { stage: "#1a2142", hemiSky: "#40528a", hemiGround: "#0b0f22", hemi: 0.42, spot: "#d8e6ff", spotI: 3.4, angle: 0.36, rim: 1.4, ink: "#f3f1ec", accentText: B.accentOnDark },
];

// the stage: a floor that bends up into the back wall with no seam
const prof = [];
for (let z = 9; z > -2.4; z -= 0.6) prof.push([z, 0]);
for (let i = 0; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); prof.push([-2.4 - 2.2 * Math.sin(a), 2.2 - 2.2 * Math.cos(a)]); }
for (let y = 3; y <= 16; y += 1) prof.push([-4.6, y]);
const sweepPos = [], sweepIdx = [];
prof.forEach(([z, y]) => sweepPos.push(-14, y, z, 14, y, z));
for (let i = 0; i + 1 < prof.length; i++) sweepIdx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
const sweepGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(sweepPos, 3)).setIndex(sweepIdx);
sweepGeo.computeVertexNormals();
const stageMat = new THREE.MeshStandardMaterial({ color: B.paper, roughness: 0.92, side: THREE.DoubleSide });
const sweep = new THREE.Mesh(sweepGeo, stageMat);
sweep.receiveShadow = true;
scene.add(sweep);

// the plinth: a low round step with a soft top edge and a thin ring in the brand's colour
const plinthMat = new THREE.MeshStandardMaterial({ color: B.paper, roughness: 0.8 });
const plinth = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [PR, 0], [PR, 0.25], [PR - 0.02, 0.3], [PR - 0.07, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)), 128), plinthMat);
plinth.position.x = PX;
plinth.castShadow = plinth.receiveShadow = true;
scene.add(plinth);
const ring = new THREE.Mesh(new THREE.TorusGeometry(PR + 0.002, 0.012, 8, 128).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: B.accent, roughness: 0.5, emissive: B.accent, emissiveIntensity: 0 }));
ring.position.set(PX, 0.2, 0);
scene.add(ring);
const TOP = 0.32;

const hemi = new THREE.HemisphereLight("#fff8ee", "#d6cfc4", 1.1);
scene.add(hemi);
const spot = new THREE.SpotLight("#fff1de", 2.4, 0, 0.62, 0.85, 0);
spot.position.set(1.6, 8.5, 4.2);
spot.target.position.set(PX + 0.35, 0.6, 0.4);
spot.castShadow = true;
spot.shadow.mapSize.set(2048, 2048);
spot.shadow.camera.near = 3;
spot.shadow.camera.far = 16;
spot.shadow.radius = 7;
spot.shadow.blurSamples = 16;
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);
const fill = new THREE.DirectionalLight("#ffffff", 0.45);
fill.position.set(-5, 3, 6);
const rim = new THREE.DirectionalLight("#dfe8ff", 0.5);
rim.position.set(-1.5, 4, -4);
scene.add(fill, rim);


// the beam: a soft cone of light from the spot, seen only in the dark mood
const beamGeo = new THREE.CylinderGeometry(0.05, 1.35, 1, 64, 1, true).translate(0, -0.5, 0);
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { amt: { value: 0 }, col: { value: new THREE.Color("#c9dbff") } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      vH = -position.y; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float amt; uniform vec3 col; varying vec3 vN; varying vec3 vV; varying float vH;
    void main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float h = smoothstep(0.0, 0.25, vH) * (1.0 - smoothstep(0.75, 1.0, vH));
      gl_FragColor = vec4(col * amt * 0.16 * f * h, 1.0); }`,
});
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.position.copy(spot.position);
const BEAM_END = new THREE.Vector3(PX + 0.1, 0, 0.1), beamDir = new THREE.Vector3().subVectors(BEAM_END, spot.position);
beam.scale.set(1, beamDir.length(), 1);
beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir.clone().normalize());
scene.add(beam);
let seed = 13;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const MOTES = Array.from({ length: 60 }, () => [rand() * 2 - 1, rand() * 2 - 1, rand(), rand()]);
const moteGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MOTES.length * 3), 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: "#dfe9ff", size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
scene.add(motes);

// each beat's object, built once, drawn solid and fitted onto the plinth (at most 1.45 tall and 1.8 wide, smaller
// between two narrators). "count" copies stand in a row (two rows from five, staggered so the back row shows between),
// each a little out of step.
const PAINT = { body: "#f4efe6", ink: "#2b2b30", accent: B.accent };
const MAXH = DUO ? 1.2 : 1.45, MAXW = DUO ? 1.3 : 1.8;
const objs = P.beats.map((b) => {
  const n = b.count ?? 1, rows = n > 4 ? 2 : 1, holder = new THREE.Group(), copies = [];
  for (let c = 0; c < n; c++) {
    const g = soften(OBJECTS[b.object](), PAINT), spin = new THREE.Group();
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const row = rows === 2 && c >= Math.ceil(n / 2) ? 1 : 0, inRow = rows === 2 ? (row ? n - Math.ceil(n / 2) : Math.ceil(n / 2)) : n;
    const j = row ? c - Math.ceil(n / 2) : c, cellW = (MAXW * (n > 1 ? 1.25 : 1)) / Math.ceil(n / rows);
    const k = Math.min((MAXH * (rows === 2 ? 0.62 : n > 1 ? 0.8 : 1)) / size.y, cellW / Math.max(size.x, size.z));
    g.scale.setScalar(k);
    g.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
    const stagger = rows === 2 && n % 2 === 0 ? (row ? 0.25 : -0.25) : 0; // equal rows: each shifts a quarter place so the back shows between
    spin.position.set((j - (inRow - 1) / 2 + stagger) * cellW, 0, rows === 2 ? (row ? 0.42 : -0.32) : 0);
    spin.add(g);
    holder.add(spin);
    copies.push({ g, spin, k, top: size.y * k });
  }
  holder.position.set(PX, TOP, 0);
  holder.visible = false;
  scene.add(holder);
  return { holder, copies, front: !!copies[0].g.userData.front };
});

// the narrators stand on the floor in front of the plinth, turned to the camera, each with a small spotlight of their
// own so they stay readable when the stage goes dark. P.speakers says who talks from which second on.
const NARR = P.narrators?.length ? P.narrators : [{}];
const SPOTS = P.portrait ? [[0, 2.0, -1]] : DUO ? [[-0.8, 1.9, 1], [0.8, 1.9, -1]] : [[0.86, 2.0, -1]];
const speakerAt = (t) => (P.speakers ?? []).reduce((who, s) => (s.t <= t + 0.01 ? s.who : who), 0);
const narrators = NARR.map((fig, k) => {
  const [x, z, toward] = SPOTS[k], p = makePuppet(fig);
  p.root.scale.setScalar(DUO ? 0.11 : 0.135);
  p.root.position.set(x, 0, z);
  p.root.rotation.y = Math.atan2(-x, 10 - z);
  const light = new THREE.SpotLight("#ffe9d2", 0, 0, 0.2, 0.9, 0);
  light.position.set(x + 1.2, 7, z + 4.5);
  light.target.position.set(x, 0.8, z);
  scene.add(p.root, light, light.target);
  return { p, toward, light, words: P.words.filter((w) => speakerAt(w.start) === k) };
});
if (P.portrait) [plinth, ring].forEach((o) => (o.visible = false));

const cap = document.getElementById("cap"), drawCaption = captionDrawer(cap, P);
const cta = document.getElementById("cta"), term = document.getElementById("term"), tag = document.getElementById("tag");
document.documentElement.style.setProperty("--accent", B.accent);
const toScreen = (v, g) => {
  const s = new THREE.Vector3(...v).applyMatrix4(g.matrixWorld).project(camera);
  return [((s.x + 1) / 2) * 1080, ((1 - s.y) / 2) * 1920];
};
const blinkAt = (t) => { // a blink about every 3 s, closing fast and opening slower
  const d = (t + 2.1) % 3.1 - 2.8 + 0.4 * Math.sin(Math.floor((t + 2.1) / 3.1) * 2.3);
  return d >= 0 && d < 0.07 ? d / 0.07 : d >= 0.07 && d < 0.27 ? 1 - (d - 0.07) / 0.2 : 0;
};
// how dark the stage is: 0 before the turn, 1 after it (and back to 0 at an optional turn back)
const moodAt = (t) => (P.turn == null ? 0 : smooth((t - P.turn) / 0.7)) * (P.turnBack == null ? 1 : 1 - smooth((t - P.turnBack) / 0.7));
const mix = (a, b, m) => new THREE.Color(a).lerp(new THREE.Color(b), m);

function renderAt(t) {
  const m = moodAt(t), A = MOOD[0], D = MOOD[1];
  stageMat.color.copy(mix(A.stage, D.stage, m));
  plinthMat.color.copy(mix(A.stage, D.stage, m)).offsetHSL(0, 0, 0.03);
  renderer.setClearColor(stageMat.color);
  hemi.color.copy(mix(A.hemiSky, D.hemiSky, m));
  hemi.groundColor.copy(mix(A.hemiGround, D.hemiGround, m));
  hemi.intensity = A.hemi + (D.hemi - A.hemi) * m;
  spot.color.copy(mix(A.spot, D.spot, m));
  spot.intensity = A.spotI + (D.spotI - A.spotI) * m;
  spot.angle = A.angle + (D.angle - A.angle) * m;
  rim.intensity = A.rim + (D.rim - A.rim) * m;
  fill.intensity = 1.0 - 0.45 * m;
  narrators.forEach((n) => (n.light.intensity = 2.6 * m));
  stageMat.emissive.copy(stageMat.color).multiplyScalar(0.2 * (1 - m));
  fill.color.copy(mix("#ffffff", "#8ea6e0", m));
  ring.material.emissiveIntensity = 0.8 * m;
  beamMat.uniforms.amt.value = m;
  motes.material.opacity = 0.55 * m;
  const mp = moteGeo.attributes.position;
  MOTES.forEach(([x, z, h, s], i) => { // dust inside the beam, sinking slowly
    const w = 0.25 + 0.7 * ((h + 0.02 * t * (0.5 + s)) % 1), p = spot.position.clone().lerp(BEAM_END, w);
    mp.setXYZ(i, p.x + 1.1 * w * x + 0.04 * Math.sin(t * 0.7 + i), p.y, p.z + 1.1 * w * z);
  });
  mp.needsUpdate = true;
  document.documentElement.style.setProperty("--ink", "#" + mix(A.ink, D.ink, m).getHexString());
  document.documentElement.style.setProperty("--accent-text", "#" + mix(A.accentText, D.accentText, m).getHexString());

  // the camera drifts slowly round the stage and leans in after the turn; the figure check looks at the narrator
  const ang = 0.06 * Math.sin(2 * Math.PI * 0.035 * t), dist = P.portrait ? 6.2 : 10 - 0.5 * m;
  camera.position.set(dist * Math.sin(ang), P.portrait ? 1.3 : 2.0, (P.portrait ? 2 : 0) + dist * Math.cos(ang));
  camera.lookAt(P.portrait ? new THREE.Vector3(0, 0.95, 2) : AIM);
  camera.updateMatrixWorld(); // the words placed on objects below are projected through it before the render does this

  // the current object rises out of the plinth with a small overshoot; the last one sinks away first
  const i = P.beats.findLastIndex((b) => b.t <= t);
  objs.forEach((o, n) => {
    const b = P.beats[n], next = P.beats[n + 1], local = t - b.t;
    const s = local < 0 ? 0 : (b.t <= 0 ? 1 : springIn(local)) * (1 - (next ? smooth((t - next.t + 0.25) / 0.25) : 0));
    o.holder.visible = s > 1e-3;
    if (!o.holder.visible) return;
    o.holder.scale.setScalar(Math.max(1e-3, s));
    o.copies.forEach((c, j) => {
      // most objects turn slowly on the plinth; the comment box and terminal face the viewer so words can go in them
      c.spin.rotation.y = o.front ? 0 : -0.45 + 0.3 * Math.sin(2 * Math.PI * 0.08 * (t - b.t) + j) + 0.25 * smooth(local / 1.2);
      c.g.userData.act?.(Math.max(0, local - 0.5) + j * 0.37);
    });
  });
  const cur = i >= 0 ? objs[i] : null, landed = cur && t - P.beats[i].t > 0.45;
  cur?.holder.updateMatrixWorld(true);

  // the comment box gets the CTA word typed in; a terminal types its lines; a tag pops in above the object (clear of
  // the narrator)
  const first = cur?.copies[0];
  if (P.cta && P.beats[i]?.object === "comment" && t >= P.cta.t + 0.3 && first) {
    const [x, y] = toScreen(first.g.userData.anchor, first.g), n = Math.min(P.cta.word.length, Math.floor((t - P.cta.t - 0.3) / (2 / 30)));
    cta.textContent = P.cta.word.slice(0, n) + (Math.floor(t * 2) % 2 ? "" : "|");
    Object.assign(cta.style, { left: `${x}px`, top: `${y}px` });
  } else cta.textContent = "";
  const B_ = P.beats[i];
  if (landed && B_.object === "terminal" && B_.lines) {
    const [x, y] = toScreen(first.g.userData.anchor, first.g), total = B_.lines.reduce((s, l) => s + [...l].length, 0);
    const until = (P.beats[i + 1] ? P.beats[i + 1].t - 0.3 : P.dur) - (B_.t + 0.45), rate = total / Math.max(0.6, Math.min(2.5, until * 0.75));
    let left = Math.floor((t - B_.t - 0.45) * rate);
    term.replaceChildren(...B_.lines.map((l) => {
      const chars = [...l], row = document.createElement("div");
      chars.slice(0, Math.max(0, left)).forEach((ch, n) => row.append(Object.assign(document.createElement("span"), { textContent: ch,
        className: n === 0 && "$✓>".includes(ch) ? "hot" : "" })));
      left -= chars.length;
      return row;
    }));
    Object.assign(term.style, { left: `${x}px`, top: `${y}px` });
  } else term.replaceChildren();
  if (landed && B_.tag) {
    const box = new THREE.Box3().setFromObject(cur.holder), [x, y] = toScreen([(box.min.x + box.max.x) / 2, box.max.y, 0], scene);
    const dt = t - B_.t - 0.45, s = Math.max(0, Math.min(1.08, 1 - Math.exp(-9 * dt) * Math.cos(12 * dt)));
    tag.textContent = B_.tag;
    tag.style.display = "block"; // before reading its width, which is 0 while hidden
    Object.assign(tag.style, { left: `${Math.max(120, Math.min(x - tag.offsetWidth / 2, 960 - tag.offsetWidth))}px`, top: `${Math.max(440, y - 70)}px`,
      transform: `rotate(-4deg) scale(${s.toFixed(3)})` });
  } else tag.style.display = "none";

  // the narrators talk on their own words, present each new object, think for a moment after the turn, and wave in
  // the figure check
  const since = i >= 0 ? t - P.beats[i].t : 99;
  const present = P.portrait ? 0 : smooth((since - 0.15) / 0.4) * (1 - smooth((since - 1.9) / 0.6));
  const think = P.turn == null ? 0 : smooth((t - P.turn - 0.3) / 0.5) * (1 - smooth((t - P.turn - 3.2) / 0.6));
  narrators.forEach((n, k) => n.p.pose(t, { mouth: mouthAt(n.words, t + 0.067), blink: blinkAt(t + 1.3 * k), brow: 0.25 + 0.75 * think,
    tilt: 0.1 * n.toward * think, point: present * (1 - think), think, wave: P.portrait ? 1 : 0, toward: n.toward }));

  drawCaption(t);
  renderer.render(scene, camera);
}

window.__renderAt = renderAt;
renderAt(window.__lastT || 0);
window.__threeReady();

// Comic: each idea is a comic panel. Paper-cut figures and solid objects are inked, halftoned in their shadows and
// printed a little off register; narration boxes, speech bubbles and sound words carry the words; impact frames flash
// on the hits. Characters move on twos (12 poses a second), the camera on ones.
import * as THREE from "three";
import { OBJECTS } from "./shared/objects.js";
import { soften } from "./shared/soft.js";
import { makePuppet, mouthAt } from "./shared/puppet.js";

const P = window.PLAN, B = P.brand, W = 1080, H = 1920;
const clamp = (v) => Math.min(1, Math.max(0, v));
const springIn = (x) => (x <= 0 ? 0 : 1 - Math.exp(-9 * x) * Math.cos(13 * x));
const PAPER = new THREE.Color("#f4efe4"), INK = new THREE.Color("#141414"), RED = new THREE.Color("#e8322b");
document.documentElement.style.setProperty("--accent", B.accent);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("page"), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.autoClear = false;
const rtOpts = { type: THREE.HalfFloatType, samples: 4 };
const colorRT = new THREE.WebGLRenderTarget(W, H, rtOpts), ndRT = new THREE.WebGLRenderTarget(W, H, rtOpts);

// three tones of light, like flat comic colouring
const GRAD = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;
const toonCache = new Map();
function toonify(root) {
  const conv = (m) => {
    if (!m || m.isShaderMaterial) return m;
    if (!toonCache.has(m)) toonCache.set(m, new THREE.MeshToonMaterial({ color: m.color, map: m.map ?? null, gradientMap: GRAD,
      emissive: m.emissive ?? new THREE.Color(0), transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits }));
    return toonCache.get(m);
  };
  root.traverse((o) => o.isMesh && (o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material)));
  return root;
}
// the second pass: each pixel's normal and distance from the camera, for the ink lines
const ND = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: `varying vec3 vN; varying float vZ;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vN; varying float vZ; void main() { gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, vZ / 40.0); }`,
});

// panel backgrounds, drawn on a far plane that rides with the camera: a night sky, a burst of speed lines, soft dots
const BG = {
  night: [new THREE.Color("#5a46a8"), new THREE.Color("#221a52"), 0],
  burst: [new THREE.Color("#ffe27a"), new THREE.Color("#ff8a1f"), 1],
  dots: [new THREE.Color("#fdf2c8"), new THREE.Color("#f4c9a8"), 0],
  sky: [new THREE.Color("#d9f0f7"), new THREE.Color("#9fd2e6"), 1],
};
function background(kind, rect, poly) {
  const [inner, outer, lines] = BG[kind];
  const m = new THREE.ShaderMaterial({
    depthWrite: true,
    uniforms: { inner: { value: inner }, outer: { value: outer }, lines: { value: lines }, center: { value: new THREE.Vector2(rect[0] + rect[2] / 2, H - rect[1] - rect[3] * 0.45) },
      size: { value: Math.hypot(rect[2], rect[3]) / 2 }, impact: { value: 0 },
      // the panel's corners in GL pixels: a slanted column paints only inside itself, not over its neighbour's wedge
      pts: { value: poly.map(([x, y]) => new THREE.Vector2(x, H - y)) }, clip: { value: 1 } },
    vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 inner, outer; uniform float lines, size, impact, clip; uniform vec2 center; uniform vec2 pts[4];
      float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float side(vec2 a, vec2 b, vec2 p) { vec2 e = b - a, q = p - a; return e.x * q.y - e.y * q.x; }
      void main() {
        if (clip > 0.5) {
          vec2 p = gl_FragCoord.xy; float s0 = side(pts[0], pts[1], p), s1 = side(pts[1], pts[2], p), s2 = side(pts[2], pts[3], p), s3 = side(pts[3], pts[0], p);
          if (!((s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0 && s3 >= 0.0) || (s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0 && s3 <= 0.0))) discard;
        }
        vec2 d = gl_FragCoord.xy - center; float r = length(d) / size, a = atan(d.y, d.x);
        vec3 c = mix(inner, outer, smoothstep(0.0, 1.1, r));
        float k = floor((a + 3.14159) / 6.28318 * 90.0), on = step(0.62, hash(k)) * smoothstep(0.18, 0.45, r);
        c = mix(c, vec3(1.0, 0.98, 0.9), on * max(lines, impact) * 0.85);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), m);
  plane.position.z = -25;
  return plane;
}

// what stands in a panel
const PAINT = { body: "#f4efe6", ink: "#2b2b30", accent: B.accent };
const fit = (g, h, w = h) => { // at most h tall and w wide (or deep)
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = Math.min(h / size.y, w / Math.max(size.x, size.z));
  g.scale.multiplyScalar(k);
  g.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  return g;
};
const CAST = {
  // the villain: the beat's object, big, with an angry face (eyes, brows and a mouth of teeth), from below
  villain(b) {
    const g = new THREE.Group(), holder = new THREE.Group();
    holder.add(fit(soften(OBJECTS[b.object](), PAINT), 2.3, 2.2));
    holder.rotation.y = -0.3;
    g.add(holder);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), c = box.getCenter(new THREE.Vector3()), h = box.max.y - box.min.y, z = box.max.z + 0.06;
    const mat = (color, e = 0) => new THREE.MeshToonMaterial({ color, emissive: e ? color : "#000000", emissiveIntensity: e, gradientMap: GRAD });
    const slab = (pts, m) => new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([a, q]) => new THREE.Vector2(a, q))), { depth: 0.04, bevelEnabled: false }), m);
    [-1, 1].forEach((s) => {
      const eye = slab([[-0.26, -0.07], [0.26, -0.11], [0.22, 0.09], [-0.24, 0.06]], mat("#ff2a1f", 0.9));
      eye.position.set(c.x + 0.36 * s, c.y + 0.18 * h, z);
      eye.rotation.z = -0.35 * s;
      const brow = slab([[-0.3, -0.06], [0.3, -0.06], [0.3, 0.06], [-0.3, 0.06]], mat("#141414"));
      brow.position.set(c.x + 0.34 * s, c.y + 0.18 * h + 0.2, z);
      brow.rotation.z = 0.5 * s;
      g.add(eye, brow);
    });
    const mouth = slab([[-0.48, -0.16], [0.48, -0.16], [0.42, 0.14], [-0.42, 0.14]], mat("#141414"));
    mouth.position.set(c.x, c.y - 0.12 * h, z);
    g.add(mouth);
    for (let k = 0; k < 6; k++) {
      const x = -0.36 + k * 0.144, tooth = slab(k % 2 ? [[x - 0.06, -0.15], [x + 0.06, -0.15], [x, 0]] : [[x - 0.06, 0.13], [x + 0.06, 0.13], [x, -0.02]], mat("#fbf8f2"));
      tooth.position.set(c.x, c.y - 0.12 * h, z + 0.02);
      g.add(tooth);
    }
    return { root: g, look: new THREE.Vector3(-0.45, 1.35, 0), cam: new THREE.Vector3(0.5, 0.05, 5.4), fov: 44, span: 1.5, bg: "night",
      act: (t) => (g.rotation.y = 0.1 * Math.sin(t * 2.4)) };
  },
  // the hero close up, or whole with the beat's object as a prop: pointing with a fist up, or thinking
  face(b) {
    const f = makePuppet(FIG);
    f.root.scale.setScalar(0.25);
    return { root: f.root, figure: f, look: new THREE.Vector3(0, 2.15, 0), cam: new THREE.Vector3(0.25, 1.65, 2.7), fov: 40, span: 0.75, bg: "dots",
      act: (t, mouth) => f.pose(t, { mouth, brow: 0.7, tilt: 0.08, blink: 0 }) };
  },
  hero(b) {
    const g = new THREE.Group(), f = makePuppet(FIG);
    f.root.scale.setScalar(0.25);
    g.add(f.root);
    let prop = null;
    if (b.object) {
      prop = new THREE.Group();
      prop.add(fit(soften(OBJECTS[b.object](), PAINT), 0.6, 0.62));
      prop.position.set(-0.9, 2.2, 0.7); // up beside the head, in front of the arms
      g.add(prop);
    }
    const think = b.hero === "think";
    // framed low, so the head sits under the speech bubble at the top of the safe area
    return { root: g, figure: f, look: new THREE.Vector3(-0.15, 1.8, 0), cam: new THREE.Vector3(0.4, 0.95, 5.2), fov: 40, span: 1.2, bg: think ? "dots" : "burst",
      act: (t, mouth) => {
        f.pose(t, think ? { mouth, brow: 1, think: 1, tilt: 0.1, toward: -1 } : { mouth, brow: 0.6, point: 1, wave: 1, toward: -1 });
        if (prop) (prop.rotation.y = -0.6 + 0.5 * Math.sin(t * 1.7)), (prop.position.y = 2.2 + 0.08 * Math.sin(t * 2.3));
      } };
  },
  object(b, k) {
    const g = new THREE.Group(), o = soften(OBJECTS[b.object](), PAINT);
    g.add(fit(o, 1.4, 1.15));
    g.rotation.y = b.object === "comment" ? 0 : -0.35;
    return { root: g, look: new THREE.Vector3(0, 0.55, 0), cam: new THREE.Vector3(0, 0.4, 3.9), fov: 40, span: 0.7,
      bg: k % 2 ? "dots" : "sky", act: (t) => o.userData.act?.(t) };
  },
};

// The pages. A beat is a panel. It fills a page of its own, except a hero close-up ("hero": "face") after a full panel,
// which lands as an inset on that page, and "count" copies, which stand in that many slanted columns.
const FIG = P.narrators?.[0] ?? {};
const FULL = [[40, 60], [1040, 60], [1040, 1860], [40, 1860]], INSET = [[110, 820], [590, 820], [590, 1235], [110, 1235]];
const COLS = {
  2: [[[40, 60], [560, 60], [480, 1860], [40, 1860]], [[580, 60], [1040, 60], [1040, 1860], [500, 1860]]],
  3: [[[40, 60], [380, 60], [300, 1860], [40, 1860]], [[400, 60], [720, 60], [640, 1860], [320, 1860]], [[740, 60], [1040, 60], [1040, 1860], [660, 1860]]],
};
const kindOf = (b) => (b.hero === "face" ? "face" : b.hero ? "hero" : b.villain ? "villain" : "object");
const pages = [];
P.beats.forEach((b, i) => {
  const last = pages.at(-1), n = b.count ?? 1;
  if (kindOf(b) === "face" && last?.layout === "full" && last.panels.length === 1 && !b.impact) return last.panels.push({ b, poly: INSET, t: b.t });
  if (n > 1) return pages.push({ t: b.t, layout: "cols", panels: COLS[n].map((poly, k) => ({ b, poly, t: b.t + 0.3 * k, k })) });
  pages.push({ t: b.t, layout: "full", panels: [{ b, poly: FULL, t: b.t, k: i }] });
});
const bbox = (poly) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
};
for (const pg of pages) for (const p of pg.panels) {
  p.rect = bbox(p.poly);
  p.scene = new THREE.Scene();
  p.cast = CAST[kindOf(p.b)](p.b, p.k ?? 0);
  p.camera = new THREE.PerspectiveCamera(p.cast.fov, p.rect[2] / p.rect[3], 0.1, 60);
  toonify(p.cast.root);
  const key = new THREE.DirectionalLight("#ffffff", 2.4);
  key.position.set(-3, 5, 4);
  p.scene.add(p.cast.root, key, new THREE.AmbientLight("#ffffff", 0.9), p.camera);
  p.bg = background(p.cast.bg, p.rect, p.poly);
  p.camera.add(p.bg);
}

// the post pass: ink where normals or distance jump, halftone dots in the shadows, colours a little off register;
// an impact frame turns the panel to red, black and white
const post = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: colorRT.texture }, tND: { value: ndRT.texture }, res: { value: new THREE.Vector2(W, H) }, impact: { value: 0 },
    paper: { value: PAPER }, ink: { value: INK }, red: { value: RED } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `uniform sampler2D tColor, tND; uniform vec2 res; uniform float impact; uniform vec3 paper, ink, red; varying vec2 vUv;
    float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
    void main() {
      vec2 px = 1.0 / res; vec4 nd = texture2D(tND, vUv);
      float edge = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398; vec2 o = vec2(cos(a), sin(a)) * 1.6 * px; vec4 q = texture2D(tND, vUv + o);
        if (q.a <= 0.0 || nd.a <= 0.0) continue;
        float dz = abs(q.a - nd.a) / max(min(q.a, nd.a), 1e-3), dn = 1.0 - dot(q.rgb * 2.0 - 1.0, nd.rgb * 2.0 - 1.0);
        edge = max(edge, max(step(0.012, dz), step(0.3, dn)));
      }
      vec3 c = texture2D(tColor, vUv).rgb;
      c.r = texture2D(tColor, vUv + vec2(2.0, 0.0) * px).r;
      c.b = texture2D(tColor, vUv + vec2(-1.5, 1.0) * px).b;
      float L = lum(c), s = smoothstep(0.68, 0.2, L);
      vec2 g = mat2(0.966, -0.259, 0.259, 0.966) * (vUv * res) / 9.0, f = fract(g) - 0.5;
      c = mix(c, c * 0.5, step(length(f), 0.6 * sqrt(s)) * step(0.03, s));
      c = mix(c, ink, edge);
      if (impact > 0.5) {
        bool back = nd.a > 0.5;
        c = back ? (L > 0.78 ? paper : red) : (edge > 0.5 ? paper : ink);
      }
      float n = fract(sin(dot(floor(vUv * res), vec2(12.9898, 78.233))) * 43758.5453);
      gl_FragColor = vec4(c * (0.975 + 0.025 * n), 1.0);
    }`,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post), postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(quad);

// words. Each caption line is a narration box, or a speech bubble when a panel with the hero is up; its stressed
// words in the brand colour. Plus sound words ("sfx"), name cards ("tag") and the comment word, stamped big.
const over = document.getElementById("over"), gut = document.getElementById("gutters");
const make = (cls, css = "") => over.appendChild(Object.assign(document.createElement("div"), { className: cls, style: css }));
const pageAt = (t) => pages.findLast((p) => p.t <= t + 1e-6) ?? pages[0];
// a caption line starts a moment before its first word, so a panel landing on that word still counts as speaking it
const speaking = (pg, t) => pg.panels.findLast((p) => p.t <= t + 0.15 && p.cast.figure);
// a line belongs to the page its words are on (a page lands on its beat's word, a hair after the line starts); a line
// that a page turn splits goes on as a new box or bubble on the new page
let wi = 0;
const lines = [];
P.captions.forEach((g, gi) => {
  const ws = [], segs = [];
  while (wi < P.words.length && ws.map((w) => w.text).join(" ").length < g.text.length) ws.push(P.words[wi++]);
  for (const w of ws) {
    const pg = pageAt(w.start);
    if (!segs.length || segs.at(-1).pg !== pg) segs.push({ pg, ws: [] });
    segs.at(-1).ws.push(w);
  }
  const next = P.captions[gi + 1]?.start - 0.05 || Infinity;
  segs.forEach(({ pg, ws: sw }, k) => {
    const who = speaking(pg, sw[0].start), e = make(who ? "bubble" : "box");
    sw.forEach((w, n) => e.append(Object.assign(document.createElement("span"), { textContent: (n ? " " : "") + w.text, className: w.stress ? "hot" : "" })));
    // where it sits: a bubble over the speaker, a box at the top left (at the bottom on a page of columns)
    const inset = who?.poly === INSET;
    if (inset) e.classList.add("small");
    e.style.cssText = who ? `left:${inset ? 605 : who.b.hero === "face" ? 300 : 430}px;top:${inset ? 820 : 290}px;width:${inset ? 355 : 520}px`
      : `left:130px;top:${pg.layout === "cols" ? 1110 : 290}px;max-width:600px;transform:rotate(-1deg)`;
    let svg = null;
    if (who) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "1");
      svg.setAttribute("height", "1");
      svg.style.cssText = "left:0;top:0;z-index:-1";
      e.appendChild(svg);
    }
    lines.push({ e, svg, who, page: pg, t: k ? pg.t : g.start - 0.05, until: k + 1 < segs.length ? segs[k + 1].pg.t : next });
  });
});
const extras = [];
for (const pg of pages) {
  const until = pages[pages.indexOf(pg) + 1]?.t ?? Infinity;
  pg.panels.forEach((p, n) => {
    if (pg.layout === "cols" && p.k > 0) return; // one tag and one sound word for a page of columns
    // a name card at the bottom right of the safe area, clear of the bubble, the box and the inset
    if (p.b.tag) extras.push({ e: make("card"), text: p.b.tag, t: p.t + 0.25, until, place: (e) => [960 - e.offsetWidth, 1170] });
    // a sound word: across the middle, gone when an inset lands (above the inset when it's the inset's own)
    const inset = p.poly === INSET, then = pg.panels[n + 1]?.t ?? until;
    if (p.b.sfx) extras.push({ e: make("sfx"), text: p.b.sfx, t: p.t + 0.35, until: then, sfx: true, rot: -10,
      place: (e) => [540 - e.offsetWidth / 2, pg.layout === "cols" ? 420 : inset ? 560 : 900] });
  });
  const b = pg.panels[0].b;
  if (P.cta && b.cta)
    extras.push({ e: make("sfx"), text: P.cta.word, t: P.cta.t + 0.35, until: Infinity, sfx: true, rot: -6, place: (e) => [540 - e.offsetWidth / 2, 560] });
}
extras.forEach((x) => (x.e.textContent = x.text));

const project = (v, p) => { // a world point in panel p, to page pixels
  const s = v.clone().project(p.camera);
  return [p.rect[0] + ((s.x + 1) / 2) * p.rect[2], p.rect[1] + ((1 - s.y) / 2) * p.rect[3]];
};
function renderAt(t) {
  const tq = Math.floor(t * 12 + 1e-6) / 12; // characters on twos
  const mouth = mouthAt(P.words, tq + 0.067);
  const hitB = P.beats.find((b) => b.impact && t >= b.t && t < b.t + 0.13);
  const pg = pageAt(t), hitP = hitB && pages.flatMap((q) => q.panels).find((p) => p.b === hitB);
  const shown = hitP ? [hitP] : pg.panels.filter((p) => p.t <= t + 1e-6);
  for (const [rt, override] of [[colorRT, null], [ndRT, ND]]) {
    rt.viewport.set(0, 0, W, H);
    rt.scissor.set(0, 0, W, H);
    rt.scissorTest = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(override ? 0x000000 : PAPER, override ? 0 : 1);
    renderer.clear();
    for (const p of shown) {
      const rect = hitP ? [0, 0, W, H] : p.rect, since = Math.min(6, t - p.t);
      p.cast.act(tq - p.t, mouth);
      p.camera.aspect = rect[2] / rect[3];
      // each panel lands with a small zoom punch (not the first, which is the thumbnail), then the camera drifts in
      p.camera.fov = p.cast.fov * (p.t <= 0 ? 1 : 1 + 0.1 * (1 - springIn(since))) * (1 - 0.012 * since);
      // a narrow panel backs the camera off until the cast's width (span) fits across it
      const away = p.cast.cam.clone().sub(p.cast.look), fits = p.cast.span / (away.length() * Math.tan((p.cast.fov * Math.PI) / 360) * p.camera.aspect);
      p.camera.position.copy(p.cast.look).addScaledVector(away, Math.max(1, fits));
      p.camera.lookAt(p.cast.look);
      p.camera.updateProjectionMatrix();
      p.camera.updateMatrixWorld();
      p.bg.material.uniforms.impact.value = hitP ? 1 : 0;
      p.bg.material.uniforms.clip.value = hitP ? 0 : 1; // the impact frame fills the screen
      rt.viewport.set(rect[0], H - rect[1] - rect[3], rect[2], rect[3]);
      rt.scissor.copy(rt.viewport);
      rt.scissorTest = true;
      renderer.setRenderTarget(rt); // three.js reads a target's viewport and scissor only when it is set
      renderer.clearDepth(); // inside the scissor only: an inset panel isn't hidden behind the panel under it
      p.scene.overrideMaterial = override;
      renderer.render(p.scene, p.camera);
      p.scene.overrideMaterial = null;
    }
    rt.scissorTest = false;
  }
  post.uniforms.impact.value = hitP ? 1 : 0;
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);

  // the paper: everywhere but the panels on show (a mask, so an inset stays open), with ink borders and a white flash
  // as each panel lands
  const d = (poly) => `M ${poly.map((q) => q.join(" ")).join(" L ")} Z`;
  gut.innerHTML = hitP ? "" : `<defs><mask id="open"><rect width="${W}" height="${H}" fill="#fff"/>${shown.map((p) => `<path d="${d(p.poly)}" fill="#000"/>`).join("")}</mask></defs>`
    + `<rect width="${W}" height="${H}" fill="#f4efe4" mask="url(#open)"/>`
    + shown.map((p) => `<path d="${d(p.poly)}" fill="#fff" fill-opacity="${p.t <= 0 ? 0 : clamp(1 - (t - p.t) / 0.12).toFixed(3)}" stroke="#141414" stroke-width="7" stroke-linejoin="round"/>`).join("");

  for (const w of lines) {
    const on = !hitP && t >= w.t && t < w.until && w.page === pg;
    w.e.style.display = on ? "block" : "none";
    if (!on) continue;
    const k = springIn(t - w.t);
    // a word wider than the bubble shrinks the bubble's type (measured once the font is in)
    if (!w.sized && document.fonts.status === "loaded") {
      for (let size = parseFloat(getComputedStyle(w.e).fontSize); size > 24 && w.e.scrollWidth > w.e.clientWidth + 1; size -= 2) w.e.style.fontSize = `${size - 2}px`;
      w.sized = true;
    }
    w.e.style.transform = `rotate(${w.who ? 0 : -1}deg) scale(${(0.85 + 0.15 * k).toFixed(3)})`;
    if (w.svg && w.who.t > t) w.svg.innerHTML = "";
    if (w.svg && w.who.t <= t) { // the tail leaves the bubble's bottom edge toward the mouth and stops at the head's edge
      const f = w.who.cast.figure, m = f.mouth.getWorldPosition(new THREE.Vector3());
      const hc = f.head.localToWorld(new THREE.Vector3(0, 1.7, 0)), he = f.head.localToWorld(new THREE.Vector3(1.75, 1.7, 0));
      const [mx, my] = project(m, w.who), [hx, hy] = project(hc, w.who), r = Math.hypot(project(he, w.who)[0] - hx, project(he, w.who)[1] - hy) * 1.08;
      const bx = parseFloat(w.e.style.left), by = parseFloat(w.e.style.top), bw = w.e.offsetWidth, bh = w.e.offsetHeight;
      const cx = Math.min(Math.max(mx - bx, bw * 0.22), bw * 0.78), base = bh - 6;
      // from the base (page px) toward the mouth: the first point on the head's circle, else just short of the mouth
      const B = [bx + cx, by + base], D = [mx - B[0], my - B[1]], L = Math.hypot(...D) || 1, u = [D[0] / L, D[1] / L], o = [B[0] - hx, B[1] - hy];
      const q = u[0] * o[0] + u[1] * o[1], disc = q * q - (o[0] ** 2 + o[1] ** 2 - r * r), hitAt = disc > 0 ? -q - Math.sqrt(disc) : -1;
      // the head is right under the bubble: a short stub, never a tail across the face
      const reach = hitAt > 40 ? hitAt : disc > 0 ? Math.min(L - 34, 26) : L - 34, tx = B[0] + u[0] * reach - bx, ty = B[1] + u[1] * reach - by;
      w.svg.innerHTML = `<path d="M ${cx - 30} ${base} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${cx + 30} ${base}" fill="#fff" stroke="#141414" stroke-width="5" stroke-linejoin="round"/>`;
    }
  }
  for (const x of extras) {
    const on = !hitP && t >= x.t && t < x.until;
    x.e.style.display = on ? "block" : "none";
    if (!on) continue;
    // sound words shrink until they fit across the safe area (measured once shown, when the font is surely in)
    if (x.sfx && !x.sized && document.fonts.status === "loaded") {
      for (let size = 200; size > 80 && x.e.offsetWidth > 820; size -= 10) x.e.style.fontSize = `${size}px`;
      x.sized = true;
    }
    const [px, py] = x.place(x.e), k = springIn(t - x.t);
    Object.assign(x.e.style, { left: `${px}px`, top: `${py}px`,
      transform: x.sfx ? `rotate(${x.rot}deg) scale(${(0.4 + 0.6 * Math.min(1.15, k)).toFixed(3)})` : `scale(${(0.85 + 0.15 * k).toFixed(3)})` });
  }
}

window.__renderAt = renderAt;
renderAt(window.__lastT || 0);
window.__threeReady();

// Collage: grey paper, one black-and-white halftone cut-out per idea (the object library, printed), flat shapes in the
// brand's colour, and the spoken words slamming in one by one in condensed capitals. Each new idea pulls the last page away.
import * as THREE from "three";
import { OBJECTS } from "./shared/objects.js";
import { soften } from "./shared/soft.js";

const P = window.PLAN, B = P.brand;
const clamp = (v) => Math.min(1, Math.max(0, v));
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const outBack = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);
const springIn = (x) => (x <= 0 ? 0 : 1 - Math.exp(-8 * x) * Math.cos(12 * x));
let seed = 21;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const PAPER = "#e2dfd9", INK = "#141414";
document.documentElement.style.setProperty("--paper", PAPER);
document.documentElement.style.setProperty("--ink", INK);
document.documentElement.style.setProperty("--accent", B.accent);

// the paper: grain, a few fibres and two soft folds
{
  const c = document.getElementById("grain"), g = c.getContext("2d"), img = g.createImageData(1080, 1920);
  const base = new THREE.Color(PAPER);
  for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
    const x = p % 1080, y = (p / 1080) | 0, n = (rand() - 0.5) * 16;
    const fold = 10 * Math.exp(-(((x - 520) / 3) ** 2)) - 7 * Math.exp(-(((x - 528) / 10) ** 2)) + 8 * Math.exp(-(((y - 1010) / 3) ** 2)) - 6 * Math.exp(-(((y - 1018) / 12) ** 2));
    const vig = -14 * (((x - 540) / 900) ** 2 + ((y - 960) / 1500) ** 2);
    img.data[i] = base.r * 255 + n + fold + vig;
    img.data[i + 1] = base.g * 255 + n + fold + vig;
    img.data[i + 2] = base.b * 255 + n + fold + vig;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 260; k++) {
    const x = rand() * 1080, y = rand() * 1920, a = rand() * Math.PI * 2, l = 8 + rand() * 26;
    g.strokeStyle = rand() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(60,55,50,0.10)";
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.7) * l * 0.5, y + Math.sin(a + 0.7) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}

// A cut-out: the object drawn solid in grey (or the member's own photo), printed as a halftone on newsprint, cut out
// with a white paper border. A photo with its background removed (a PNG) is cut round its outline; any other photo is
// printed as a rectangle.
const S = 720, PAD = 36, W = S + 2 * PAD, gl3 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
gl3.setPixelRatio(1);
gl3.setSize(S, S, false);
gl3.toneMapping = THREE.NeutralToneMapping;
const square = () => Object.assign(document.createElement("canvas"), { width: W, height: W });
function objectShot(name) {
  const scene = new THREE.Scene(), obj = soften(OBJECTS[name](), { body: "#f0f0f0", ink: "#3a3a3a", accent: "#9a9a9a" });
  obj.rotation.set(0.18, -0.55, 0);
  scene.add(obj);
  scene.add(new THREE.HemisphereLight("#ffffff", "#5a5a5a", 0.7));
  const key = new THREE.DirectionalLight("#ffffff", 2.6);
  key.position.set(-3, 4, 4);
  const fill = new THREE.DirectionalLight("#ffffff", 0.35);
  fill.position.set(4, 0.5, 2);
  scene.add(key, fill);
  obj.updateMatrixWorld(true);
  // the camera backs off just far enough for every corner of the object's box to fit
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), T = Math.tan((13 * Math.PI) / 180) * 0.94;
  let d = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
    d = Math.max(d, Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) / T + (z - c.z));
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  cam.position.set(c.x, c.y, c.z + d);
  cam.lookAt(c);
  gl3.setClearColor(0x000000, 0);
  gl3.render(scene, cam);
  const src = square();
  src.getContext("2d").drawImage(gl3.domElement, PAD, PAD);
  return print(src);
}
async function photoShot(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const k = Math.min(S / img.naturalWidth, S / img.naturalHeight), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const rect = { x: PAD + (S - w) / 2, y: PAD + (S - h) / 2, w, h }, src = square(), g = src.getContext("2d");
  g.drawImage(img, rect.x, rect.y, w, h);
  // see-through pixels in a fifth of the picture or more: the background was removed, so cut round the outline
  const px = g.getImageData(rect.x, rect.y, w, h).data;
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) clear += px[i] < 128;
  return print(src, { rect: clear / (w * h) > 0.2 ? null : rect, levels: true });
}
// src: a W×W canvas with the picture on it. rect: print it as that rectangle instead of round its outline. levels:
// stretch the picture's greys to full black and white first (photos are rarely full contrast)
function print(src, { rect = null, levels = false } = {}) {
  const px = src.getContext("2d").getImageData(0, 0, W, W).data;
  const lumAt = (i) => (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
  let lo = 0, hi = 1;
  if (levels) {
    const hist = new Array(256).fill(0);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 128) hist[Math.round(lumAt(i) * 255)]++, n++;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc <= n * 0.03) lo = v / 255;
      if (acc <= n * 0.97) hi = v / 255;
    }
    if (hi - lo < 0.1) (lo = 0), (hi = 1);
  }
  const out = square(), o = out.getContext("2d");
  if (rect) { // a printed rectangle on a white paper border
    o.fillStyle = "#f7f5f0";
    o.fillRect(rect.x - 18, rect.y - 18, rect.w + 36, rect.h + 36);
    o.fillStyle = "#ece8df";
    o.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    const sil = square(), sg = sil.getContext("2d"); // the picture's shape in one colour
    const tint = (color) => {
      sg.globalCompositeOperation = "source-over";
      sg.clearRect(0, 0, W, W);
      sg.drawImage(src, 0, 0);
      sg.globalCompositeOperation = "source-in";
      sg.fillStyle = color;
      sg.fillRect(0, 0, W, W);
      return sil;
    };
    tint("#f7f5f0");
    for (let k = 0; k < 36; k++) { // the border: the shape pushed out 22 px all round, a little uneven like a scissor cut
      const a = (k / 36) * 2 * Math.PI, d = 20 + 4 * Math.sin(k * 2.3);
      o.drawImage(sil, d * Math.cos(a), d * Math.sin(a));
    }
    o.drawImage(tint("#ece8df"), 0, 0);
  }
  // halftone dots on a 45° grid, each as big as the picture is dark there
  const CELL = 8, ca = Math.SQRT1_2;
  o.fillStyle = INK;
  for (let v = -W; v < W; v += CELL) for (let u = 0; u < 1.5 * W; u += CELL) {
    const x = Math.round((u - v) * ca), y = Math.round((u + v) * ca);
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    if (rect && (x < rect.x || y < rect.y || x >= rect.x + rect.w || y >= rect.y + rect.h)) continue;
    const i = (y * W + x) * 4;
    if (px[i + 3] < 128) continue;
    const lum = clamp((lumAt(i) - lo) / (hi - lo)), d = clamp((0.96 - lum) * 1.35);
    if (d < 0.04) continue;
    o.beginPath();
    o.arc(x, y, CELL * 0.62 * Math.sqrt(d), 0, 2 * Math.PI);
    o.fill();
  }
  return out;
}

// laying out the words: a stressed word (the one a beat's "say" names) gets a line to itself and fills the width; the
// rest pack into short lines; then the whole block shrinks until it fits its area
const meas = document.createElement("canvas").getContext("2d");
const width = (text, size) => ((meas.font = `700 ${size}px Oswald`), meas.measureText(text.toUpperCase()).width);
const bare = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const CTA = P.cta ? bare(P.cta.word) : null;
function lines(words, maxW, maxH, small = 76) {
  for (let f = 1; ; f *= 0.9) {
    const out = [];
    for (const w of words) {
      const last = out.at(-1), sm = Math.round(small * f);
      if (w.stress || w.stamp) out.push({ words: [w], size: Math.min(250 * f, (maxW * (w.stamp ? 0.8 : 1) * 100) / width(w.text, 100)), big: true });
      else if (last && !last.big && width([...last.words, w].map((x) => x.text).join(" "), sm) <= maxW * 0.62) last.words.push(w);
      else out.push({ words: [w], size: Math.min(sm, (maxW * 100) / width(w.text, 100)), big: false });
    }
    if (out.reduce((s, l) => s + l.size * 0.9, 0) <= maxH || f < 0.3) return out;
  }
}

// each beat is a page: a shape, a cut-out (or "count" of them) and its words, placed by one of two layouts in turn.
// A page's words come in blocks, one per caption line: each block slams in word by word and the next replaces it.
const page = document.getElementById("page");
const el = (cls, css = {}, text) => {
  const e = Object.assign(document.createElement(text === undefined ? "div" : "span"), { className: cls });
  if (text !== undefined) e.textContent = text;
  Object.assign(e.style, css);
  return e;
};
// each word's caption line, counted the way captions.js fills its lines (words touch, so times can't tell them apart)
const GROUP = new Map();
{
  let wi = 0;
  P.captions.forEach((g, gi) => {
    let text = "";
    while (wi < P.words.length && text.length < g.text.length) (text += (text ? " " : "") + P.words[wi].text), GROUP.set(P.words[wi++], gi);
  });
}
const groupOf = (w) => GROUP.get(w) ?? -1;
// built once Oswald has loaded, since the layout measures the words
const buildPages = (shots) => P.beats.map((b, n) => {
  // the comment ending always takes the bar layout: the CTA word is stamped where the bar would be, and stays
  const end = P.beats[n + 1]?.t ?? P.dur, isCta = b.object === "comment" && !!CTA && Math.abs(b.t - P.cta.t) < 1e-6, A = !isCta && n % 2 === 0, root = el("layer");
  page.append(root);
  const shape = A
    ? el("shape", { left: "330px", top: "640px", width: "560px", height: "560px", borderRadius: "50%" })
    : el("shape", { left: "-40px", top: "880px", width: "820px", height: "150px" });
  if (!isCta) root.append(shape);
  // the cut-outs: one big, or up to six smaller ones in a row (two rows from four), each turned a little differently
  const cnt = b.count ?? 1, rows = cnt > 3 ? 2 : 1, per = Math.ceil(cnt / rows), full = A ? 730 : 660; // the first layout ends by y 1240
  const size = cnt === 1 ? full : Math.min(full * (rows === 2 ? 0.52 : 0.62), (820 / per) * 1.25), src = shots[n];
  const cuts = Array.from({ length: cnt }, (_, c) => {
    const cv = c ? Object.assign(document.createElement("canvas"), { width: src.width, height: src.height }) : src;
    if (c) cv.getContext("2d").drawImage(src, 0, 0);
    const row = Math.floor(c / per), j = c % per, inRow = row ? cnt - per : Math.min(per, cnt);
    const cx = (A ? 560 : 650) + (j - (inRow - 1) / 2) * size * 0.78, cy = (A ? 510 + full / 2 : 260 + full / 2) + (rows === 2 ? (row ? 0.4 : -0.4) * size : 0);
    Object.assign(cv.style, { width: `${size}px`, height: `${size}px`, left: `${cx - size / 2}px`, top: `${cy - size / 2}px` });
    cv.className = "cut";
    root.append(cv);
    return { cv, rot: (A ? -5 : 4) + (cnt > 1 ? 7 * Math.sin(c * 2.1) : 0), delay: 0.08 * c };
  });
  // the words: on the first layout they sit at the top; on the second they start on the bar and run down
  let words = P.words.filter((w) => w.start >= b.t - 0.05 && w.start < end - 0.05);
  const items = [];
  let below = 1075; // where the comment page's words start, under the stamp
  if (isCta) {
    const said = words.find((w) => bare(w.text) === CTA), at = said ? said.start : P.cta.t + 0.3, text = said ? said.text : P.cta.word;
    words = words.filter((w) => w !== said);
    const size = Math.min(230, (700 * 100) / width(text, 100)), st = el("word stamp", { left: "125px", top: "840px", fontSize: `${size}px` }, text);
    below = 840 + 1.1 * size + 24;
    root.append(st);
    items.push({ list: [{ e: st, at }], from: at, until: Infinity });
  }
  // the stressed words (the ones a beat's "say" names) stay big at the top for the whole page; the other words come
  // in blocks under them, one per caption line, each replacing the last
  const place = (ws, top, maxH, at, until) => {
    const L = lines(ws, 820, maxH), gap = 10, list = [];
    let y = top;
    L.forEach((l, li) => {
      const text = l.words.map((w) => w.text).join(" "), w = width(text, l.size);
      let cx = l.big || li % 2 === 0 ? 125 : Math.max(125, 955 - w);
      for (const wd of l.words) {
        const s = el("word", { left: `${cx}px`, top: `${y}px`, fontSize: `${l.size}px` }, wd.text);
        root.append(s);
        list.push({ e: s, at: wd.start });
        cx += width(wd.text, l.size) + 0.26 * l.size;
      }
      y += l.size * 0.86 + gap;
    });
    items.push({ list, from: at, until });
    return y;
  };
  const head = words.filter((w) => w.stress), rest = words.filter((w) => !w.stress), bottom = A ? 770 : 1250;
  let top = A ? 300 : isCta ? below : 905;
  if (head.length) top = place(head, top, A ? 300 : 230, head[0].start, Infinity) + 6;
  const blocks = [];
  for (const w of rest) {
    const g = groupOf(w);
    if (!blocks.length || blocks.at(-1).g !== g) blocks.push({ g, words: [] });
    blocks.at(-1).words.push(w);
  }
  blocks.forEach((bl, k) => place(bl.words, top, Math.max(80, bottom - top), bl.words[0].start, blocks[k + 1]?.words[0].start ?? Infinity));
  const label = el("label", { left: "182px", top: A ? "1216px" : "276px" }, `№ ${String(n + 1).padStart(2, "0")} / ${String(P.beats.length).padStart(2, "0")}`);
  root.append(label);
  return { b, end, root, shape, cuts, items, label };
});

// crop marks round the safe area, on every page
[[120, 270, "Top", "Left"], [916, 270, "Top", "Right"], [120, 1204, "Bottom", "Left"], [916, 1204, "Bottom", "Right"]].forEach(([x, y, v, h]) =>
  document.getElementById("root").append(el("crop", { left: `${x}px`, top: `${y}px`, [`border${v}Width`]: "3px", [`border${h}Width`]: "3px" })));

function renderAt(t) {
  pages.forEach((p, n) => {
    const local = t - p.b.t, out = n + 1 < pages.length ? smooth((t - p.end + 0.04) / 0.32) : 0;
    const on = local > -0.25 && out < 1;
    p.root.style.display = on ? "block" : "none";
    if (!on) return;
    // the page is pulled away to the left as the next one lands
    p.root.style.transform = `translateX(${(-1150 * out ** 1.6).toFixed(1)}px) rotate(${(-3 * out).toFixed(2)}deg)`;
    const sh = p.b.t <= 0 ? 1 : outBack(clamp((local + 0.12) / 0.4));
    p.shape.style.transform = `scale(${(sh * (1 + 0.012 * Math.sin(2 * Math.PI * 0.4 * t))).toFixed(4)})`;
    const first = p.b.t <= 0; // the first page is whole on the first frame, which is the thumbnail
    p.cuts.forEach((c) => {
      const k = first ? 1 : springIn(Math.max(0, local - c.delay));
      c.cv.style.opacity = !first && local < c.delay ? "0" : "1";
      c.cv.style.transform = `translateY(${(140 * (1 - k) + 5 * Math.sin(2 * Math.PI * 0.25 * t + c.rot)).toFixed(1)}px) rotate(${(c.rot + 9 * (1 - k) + 0.6 * Math.sin(2 * Math.PI * 0.18 * t)).toFixed(2)}deg)`;
    });
    p.label.style.opacity = String(0.75 * (first ? 1 : clamp(local / 0.3)));
    for (const bl of p.items) { // a word slams in: big for two frames, then down to size with a small jolt; a block clears when the next one starts
      const shown = t < bl.until;
      for (const it of bl.list) {
        const d = t - it.at;
        it.e.style.opacity = d < 0 || !shown ? "0" : "1";
        it.e.style.transform = `scale(${(d < 0 ? 1.3 : 1 + 0.3 * Math.exp(-28 * d) * Math.cos(30 * d)).toFixed(4)})`;
      }
    }
  });
}

let pages = [];
window.__renderAt = renderAt;
Promise.all([document.fonts.load('700 100px "Oswald"'), document.fonts.load('600 22px "JetBrains Mono"')]).then(async () => {
  // each page's picture: the member's photo (P.photos maps the plan's file to its copy in media/) or the object
  pages = buildPages(await Promise.all(P.beats.map((b) => (b.photo ? photoShot(P.photos[b.photo]) : objectShot(b.object)))));
  renderAt(window.__lastT || 0);
  window.__collageReady();
});

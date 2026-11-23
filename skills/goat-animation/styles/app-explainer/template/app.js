// App Explainer: a graphing calculator on paper. Lines type in, a slider drags, the flower blooms on the answer.
import { LAYOUT as L, ROWS, TYPE_RATE, DRAW, COLORS, squareView } from "./layout.js";
import { typeSteps, mathHTML, parseLine, freeVars, graphPath } from "./shared/math.js";
import { captionDrawer } from "./shared/captions.js";

const P = window.PLAN, B = P.beats, brand = P.brand;
const GW = L.window.w, GH = L.graph.h, TOP = GH + L.toolbar.h; // the rows start under the graph and the toolbar
const VIEW = squareView(P.view);
const [x0, x1, y0, y1] = VIEW;
const clamp = (v) => Math.min(1, Math.max(0, v));
const smooth = (u) => u * u * (3 - 2 * u);
const spring = (u) => (u >= 1 ? 1 : 1 - Math.exp(-5 * u) * Math.cos(2.5 * Math.PI * u)); // 0 to 1, a small overshoot, 1 at u = 1
const nodAt = (dt) => (dt >= 0 && dt < 0.4 ? (0.1 / 0.694) * Math.sin(3 * Math.PI * (dt / 0.4)) * (1 - dt / 0.4) ** 2 : 0); // dips 0.1, springs back
const peak = (f) => Math.max(...Array.from({ length: 201 }, (_, i) => f(i / 200)));
const minus = (s) => String(s).replaceAll("-", "−");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const $ = (id) => document.getElementById(id);
const svg = (tag, attrs, parent) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e);
  return e;
};
const place = (e, x, y, w, h) => Object.assign(e.style, { left: `${x}px`, top: `${y}px`, ...(w && { width: `${w}px` }), ...(h && { height: `${h}px` }) });
const html = (e, h) => e.__h !== h && ((e.innerHTML = h), (e.__h = h)); // only touch the DOM when it changes
const nextT = (b) => B[B.indexOf(b) + 1]?.t ?? P.dur;
const ctaOut = (t) => (P.cta ? smooth(clamp((t - P.cta.t) / 0.3)) : 0); // the window (and the cursor on it) fades and drops 30 px
const gx = (x) => ((x - x0) / (x1 - x0)) * GW, gy = (y) => (1 - (y - y0) / (y1 - y0)) * GH;

document.body.style.background = brand.paper;
const css = document.documentElement.style;
css.setProperty("--ink", brand.ink);
css.setProperty("--accent", brand.accent);
css.setProperty("--accent-text", brand.accentOnPaper ?? brand.accent);

// ---- what happens when, from the beats: rows (typed lines and sliders), drags, taps
const rows = [];
let lineNo = 0;
B.forEach((b) => {
  let at = b.t;
  const lines = b.type === undefined ? [] : [b.type].flat().map(String);
  lines.forEach((src, k) => {
    const node = parseLine(src), done = at + typeSteps(src) / TYPE_RATE; // one line after another
    rows.push({ kind: "line", src, node, vars: freeVars(node), color: COLORS[lineNo++ % COLORS.length], start: at, done,
      focusEnd: k + 1 < lines.length ? done : nextT(b) });
    at = done;
  });
  if (b.slider !== undefined) {
    const min = b.min ?? -10, max = b.max ?? 10;
    rows.push({ kind: "slider", name: b.slider, min, max, value: b.value ?? Math.min(Math.max(1, min), max), start: b.t });
  }
});
rows.splice(ROWS);
const sliderOf = (name) => rows.find((r) => r.kind === "slider" && r.name === name);
// a line draws once it is typed and every letter it uses has a slider on screen
for (const r of rows) if (r.kind === "line") r.draw = Math.max(r.done, ...r.vars.map((v) => sliderOf(v)?.start ?? Infinity));

const drags = [];
for (const b of B) {
  if (b.drag === undefined || !sliderOf(b.drag)) continue;
  const s = sliderOf(b.drag), t0 = b.t + 0.45, dur = Math.max(0.2, Math.min(1.6, nextT(b) - 0.3 - t0)); // after the glide and press
  drags.push({ kind: "drag", t: b.t, s, from: drags.findLast((d) => d.s === s)?.to ?? s.value, to: b.to, t0, dur, end: t0 + dur });
}
const taps = B.filter((b) => Array.isArray(b.tap)).map((b) => ({ kind: "tap", t: b.t, x: b.tap[0], y: b.tap[1], end: b.t + 0.45 }));
const acts = [...drags, ...taps].sort((a, b) => a.t - b.t);

// a slider's value at t, and its label: one decimal while it moves, then the exact value it was dragged to
function valueAt(s, t) {
  let v = s.value, label = String(s.value);
  for (const d of drags) {
    if (d.s !== s || t < d.t0) continue;
    const u = clamp((t - d.t0) / d.dur);
    v = d.from + (d.to - d.from) * smooth(u);
    label = u < 1 ? v.toFixed(1) : String(d.to);
  }
  return { v, label };
}

// ---- the page, placed from layout.js
const win = $("win"), titles = [...document.querySelectorAll(".title")], subs = [...document.querySelectorAll(".sub")];
for (const e of titles) place(e, L.title.cx - 410, L.title.y, 820), (e.style.fontSize = `${L.title.size}px`);
for (const e of subs) place(e, L.sub.cx - 410, L.sub.y, 820), (e.style.fontSize = `${L.sub.size}px`);
place(win, L.window.x, L.window.y, L.window.w, L.window.h);

// the graph: majors on a 1-2-5 ladder at least 100 px apart, with numbers; minors a fifth of that (a quarter after
// a 2), so the majors land on minor lines; majors drawn over minors, axes on top
const graph = $("graph");
Object.entries({ width: GW, height: GH, viewBox: `0 0 ${GW} ${GH}` }).forEach(([k, v]) => graph.setAttribute(k, v));
const steps = (a, b, s) => Array.from({ length: Math.floor(b / s + 1e-9) - Math.ceil(a / s - 1e-9) + 1 }, (_, i) => (Math.ceil(a / s - 1e-9) + i) * s);
const unit = GW / (x1 - x0); // px per unit, the same both ways
const [major, minor] = (() => {
  for (let e = 10 ** Math.floor(Math.log10(100 / unit)); ; e *= 10)
    for (const m of [1, 2, 5]) if (m * e * unit >= 100) return [m * e, (m * e) / (m === 2 ? 4 : 5)];
})();
const grid = svg("g", { "shape-rendering": "crispEdges", "stroke-width": 1 }, graph);
for (const [vs, stroke] of [[minor, "#ececec"], [major, "#d0d0d0"]]) {
  for (const v of steps(x0, x1, vs)) if (v) svg("line", { x1: gx(v), x2: gx(v), y1: 0, y2: GH, stroke }, grid);
  for (const v of steps(y0, y1, vs)) if (v) svg("line", { x1: 0, x2: GW, y1: gy(v), y2: gy(v), stroke }, grid);
}
const axes = svg("g", { stroke: "#222", "stroke-width": 1.5 }, graph);
if (x0 <= 0 && x1 >= 0) svg("line", { x1: gx(0), x2: gx(0), y1: 0, y2: GH }, axes);
if (y0 <= 0 && y1 >= 0) svg("line", { x1: 0, x2: GW, y1: gy(0), y2: gy(0) }, axes);
// numbers sit by the axes (or the nearest edge when an axis is off the graph), with a white halo over the grid;
// a number on the graph's edge moves just inside it instead of being cut in half
const nums = svg("g", { "font-family": "Inter", "font-size": 18, fill: "#555", stroke: "#fff", "stroke-width": 5, "paint-order": "stroke" }, graph);
const xAxis = Math.min(Math.max(gy(0), 0), GH - 26), yAxis = Math.min(Math.max(gx(0), 44), GW);
const inside = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const label = (v) => minus(Number(v.toPrecision(12))); // 3 * 0.2 is 0.6000000000000001
for (const v of steps(x0, x1, major)) if (v) {
  const s = label(v), half = 6 * s.length; // about half the label's width, so "−200" on the edge keeps its minus
  svg("text", { x: inside(gx(v), half, GW - half), y: xAxis + 22, "text-anchor": "middle" }, nums).textContent = s;
}
for (const v of steps(y0, y1, major)) if (v) svg("text", { x: yAxis - 8, y: inside(gy(v) + 6, 20, GH - 4), "text-anchor": "end" }, nums).textContent = label(v);
if (x0 < 0 && x1 > 0 && y0 < 0 && y1 > 0) svg("text", { x: gx(0) - 8, y: gy(0) + 22, "text-anchor": "end" }, nums).textContent = "0";
const curves = rows.map((r) => r.kind === "line" && svg("path", { fill: "none", stroke: r.color, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, graph));
const tapDot = svg("circle", { r: 6, fill: "#7a7a7a" }, graph);
const tapLabel = svg("text", { "font-family": "Inter", "font-size": 22, "font-weight": 500, fill: "#333", stroke: "#fff", "stroke-width": 6, "paint-order": "stroke" }, graph);

// the toolbar: plus, undo, redo, gear, as plain strokes
const tools = $("tools"), cy = L.toolbar.h / 2;
Object.entries({ width: GW, height: L.toolbar.h, style: `top:${GH}px` }).forEach(([k, v]) => tools.setAttribute(k, v));
svg("rect", { width: GW, height: L.toolbar.h, fill: "#f7f7f7" }, tools);
svg("path", { d: `M0 0.5H${GW}M0 ${L.toolbar.h - 0.5}H${GW}`, stroke: "#e3e3e3" }, tools);
const icons = svg("g", { fill: "none", stroke: "#5f5f5f", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, tools);
const undo = `M78 ${cy - 5}h14a7 7 0 0 1 0 14h-8M83 ${cy - 10}l-5 5 5 5`;
svg("path", { d: `M18 ${cy}h20M28 ${cy - 10}v20` }, icons);
svg("path", { d: undo }, icons);
svg("path", { d: undo, transform: "translate(217 0) scale(-1 1)" }, icons);
svg("circle", { cx: GW - 32, cy, r: 8 }, icons);
svg("circle", { cx: GW - 32, cy, r: 2.5 }, icons);
for (let k = 0; k < 8; k++) {
  const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
  svg("line", { x1: GW - 32 + 8 * c, y1: cy + 8 * s, x2: GW - 32 + 12 * c, y2: cy + 12 * s }, icons);
}

// the rows: a number gutter, the accent bar while a row is typed, the line's colour once it is graphed
const slots = Array.from({ length: ROWS }, (_, i) => {
  const row = Object.assign(document.createElement("div"), { className: "row" });
  row.innerHTML = `<div class="gut"><span class="num">${i + 1}</span><span class="dot"></span></div><div class="bar"></div><div class="body"></div>`;
  place(row, 0, TOP + i * L.row.h, null, L.row.h);
  win.append(row);
  const [dot, bar, body] = ["dot", "bar", "body"].map((c) => row.getElementsByClassName(c)[0]);
  body.style.fontSize = `${L.row.mathSize}px`;
  return { dot, bar, body };
});
const TRACK = { x: 66 + 210 + 40 + 14, w: 290 }; // .body left + .lab + .mn and its margin, in the window
const handleAt = (s, t) => {
  const i = rows.indexOf(s), u = clamp((valueAt(s, t).v - s.min) / (s.max - s.min));
  return [L.window.x + TRACK.x + u * TRACK.w, L.window.y + TOP + (i + 0.5) * L.row.h];
};

// the flower: the brand's mark in ink. It moves about its bottom centre; its box is sized so the bloom never leaves
// LAYOUT.flower (the mark sits a little smaller at rest, and the open petals stay inside SAFE)
const flower = $("flower"), petals = [];
let pose = () => {};
if (brand.markSvg) {
  place(flower, L.flower.x, L.flower.y, L.flower.size, L.flower.size);
  flower.innerHTML = brand.markSvg;
  const mark = flower.querySelector("svg"), outer = svg("g", {}), whole = svg("g", {}, outer);
  whole.append(...mark.children);
  mark.append(outer);
  Object.entries({ width: L.flower.size, height: L.flower.size, preserveAspectRatio: "xMidYMax meet" }).forEach(([k, v]) => mark.setAttribute(k, v));
  mark.style.fill = brand.ink;
  const bb = whole.getBBox(), px = bb.x + bb.width / 2, py = bb.y + bb.height;
  for (const e of whole.children) {
    if (!(e instanceof SVGGraphicsElement)) continue; // <title>, <desc>, <style> have no box
    const c = e.getBBox(), dx = c.x + c.width / 2 - px;
    petals.push({ e, sign: Math.abs(dx) < 0.05 * bb.width ? 0 : Math.sign(dx) }); // a centred petal stays upright
  }
  pose = (sway, sy, b) => {
    const s = 1 + 0.12 * b;
    whole.setAttribute("transform", `translate(${px} ${py}) rotate(${sway}) scale(${s} ${s * sy}) translate(${-px} ${-py})`);
    for (const { e, sign } of petals) e.setAttribute("transform", `rotate(${14 * sign * b} ${px} ${py})`);
  };
  // the box the flower can fill at its widest: open (with the spring's overshoot), swayed both ways, mid-nod
  const B_MAX = peak(spring), NOD_UP = 1 + peak((u) => -nodAt(u * 0.4));
  let box = null;
  for (const [sw, sy, b] of [[0, 1, 0], [2, NOD_UP, B_MAX], [-2, NOD_UP, B_MAX]]) {
    pose(sw, sy, b);
    const r = outer.getBBox();
    box = box ? [Math.min(box[0], r.x), Math.min(box[1], r.y), Math.max(box[2], r.x + r.width), Math.max(box[3], r.y + r.height)] : [r.x, r.y, r.x + r.width, r.y + r.height];
  }
  mark.setAttribute("viewBox", `${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`);
} else flower.style.display = "none";

function drawFlower(t) {
  const last = B.findLast((b) => b.t <= t), ans = B.findLast((b) => b.answer !== undefined && b.t <= t);
  // it opens with a spring over 0.5 s, holds, and closes over the 0.8 s before the next beat
  const bloom = ans ? spring(clamp((t - ans.t) / 0.5)) * smooth(clamp((nextT(ans) - t) / 0.8)) : 0;
  pose(2 * Math.sin(2 * Math.PI * 0.25 * t), 1 - (last ? nodAt(t - last.t) : 0), bloom);
}

// title and sub: the last one at or before t, crossfading from the one before over 0.25 s (the first frame shows it whole)
const titleItems = B.filter((b) => b.title !== undefined).map((b) => ({ t: b.t,
  h: [b.title].flat().map((s, i) => `<span${i ? ' style="margin-left:1.5em"' : ""}>${mathHTML(String(s))}</span>`).join("") }));
const subItems = B.filter((b) => b.sub !== undefined || b.answer !== undefined).map((b) => ({ t: b.t,
  h: esc(b.answer ?? b.sub), answer: b.answer !== undefined }));
function crossfade([a, b], items, t) {
  const i = items.findLastIndex((x) => x.t <= t), k = i < 0 ? 0 : i === 0 && items[0].t <= 0 ? 1 : clamp((t - items[i].t) / 0.25);
  for (const [e, item, o] of [[a, items[i - 1], 1 - k], [b, items[i], k]]) {
    html(e, item ? item.h : "");
    e.classList.toggle("answer", !!item?.answer);
    e.style.opacity = String(item ? o : 0);
  }
}

const caret = (on) => `<span class="caret" style="opacity:${on ? 1 : 0}"></span>`;
function drawRow(r, slot, t) {
  if (!r || t < r.start) {
    html(slot.body, "");
    slot.bar.style.opacity = slot.dot.style.opacity = "0";
    return;
  }
  const dt = t - r.start;
  if (r.kind === "line") {
    // slides up 12 px over 0.2 s and types; the caret holds while typing and blinks after
    const focused = t < r.focusEnd, on = focused && (t < r.done + 0.1 || Math.floor((t - r.done) * 2) % 2 === 0), e = smooth(clamp(dt / 0.2));
    html(slot.body, `<div class="math">${mathHTML(r.src, Math.floor(dt * TYPE_RATE))}${caret(on)}</div>`);
    slot.body.style.opacity = String(e);
    slot.body.style.transform = `translateY(${(12 * (1 - e)).toFixed(2)}px)`;
    slot.bar.style.opacity = focused ? "1" : "0";
    slot.dot.style.background = r.color;
    slot.dot.style.opacity = String(clamp((t - r.draw) / 0.15));
  } else {
    // springs in, showing its start value and a track with its handle
    const { v, label } = valueAt(r, t), u = clamp((v - r.min) / (r.max - r.min));
    html(slot.body, `<div class="math lab">${mathHTML(`${r.name} = ${label}`)}</div><span class="mn">${minus(r.min)}</span>` +
      `<div class="track"><div class="handle" style="left:${(u * TRACK.w).toFixed(1)}px"></div></div><span class="mx">${minus(r.max)}</span>`);
    slot.body.style.opacity = String(clamp(dt / 0.12));
    slot.body.style.transform = `scale(${(0.85 + 0.15 * spring(clamp(dt / 0.4))).toFixed(4)})`;
    slot.bar.style.opacity = slot.dot.style.opacity = "0";
  }
}

// the cursor: glides 0.35 s to its point, presses, follows a dragged handle, and fades out 0.6 s after. An action that
// starts while the last one's cursor still shows takes it over from where it is, without fading in again
const cursor = $("cursor"), TIP = 1.5 * (44 / 24);
cursor.style.transformOrigin = `${TIP}px ${TIP}px`;
function cursorAt(i, t) {
  const a = acts[i], p = acts[i - 1];
  const at = (tt) => (a.kind === "tap" ? [L.window.x + gx(a.x), L.window.y + gy(a.y)] : handleAt(a.s, tt));
  const first = at(a.t), to = at(t), held = p && a.t < p.end + 0.8 ? cursorAt(i - 1, a.t) : null;
  const from = held ? [held.x, held.y] : [Math.min(first[0] + 110, 900), Math.min(first[1] + 130, 1180)]; // from below right, inside SAFE
  const g = smooth(clamp((t - a.t) / 0.35)), o0 = held ? held.o : 0;
  const down = clamp((t - (a.t + 0.35)) / 0.1), press = a.kind === "tap" ? Math.sin(Math.PI * down) : down * (1 - clamp((t - a.end) / 0.1));
  return { x: from[0] + (to[0] - from[0]) * g, y: from[1] + (to[1] - from[1]) * g, press,
    o: (o0 + (1 - o0) * clamp((t - a.t) / 0.1)) * clamp((a.end + 0.8 - t) / 0.2) };
}
function drawCursor(t) {
  const i = acts.findLastIndex((x) => x.t <= t);
  if (i < 0 || t > acts[i].end + 0.8) return (cursor.style.opacity = "0");
  const { x, y, press, o } = cursorAt(i, t);
  const out = ctaOut(t);
  cursor.style.transform = `translate(${(x - TIP).toFixed(1)}px, ${(y - TIP + 30 * out).toFixed(1)}px) scale(${(1 - 0.15 * press).toFixed(3)})`;
  cursor.style.opacity = String(o * (1 - out));
}

// a tap leaves a grey dot and pops in its (x, y)
function drawTap(t) {
  const p = taps.findLast((x) => x.end <= t);
  tapDot.style.display = tapLabel.style.display = p ? "" : "none";
  if (!p) return;
  const X = gx(p.x), Y = gy(p.y), u = clamp((t - p.end) / 0.15), right = X < GW - 160;
  const f = (v) => minus(String(Number(v.toFixed(2)) || 0));
  Object.entries({ cx: X, cy: Y }).forEach(([k, v]) => tapDot.setAttribute(k, v));
  tapLabel.textContent = `(${f(p.x)}, ${f(p.y)})`;
  tapLabel.setAttribute("text-anchor", right ? "start" : "end");
  const s = smooth(u) * (1 + 0.15 * Math.sin(Math.PI * u));
  tapLabel.setAttribute("transform", `translate(${X + (right ? 12 : -12)} ${Y < 34 ? Y + 30 : Y - 12}) scale(${s.toFixed(3)})`);
  tapLabel.style.opacity = String(u);
}

// the CTA: the window drops away and a comment pill springs in where it was; the title and answer stay above it
const comment = $("comment"), said = $("said"), ctaCaret = comment.querySelector(".caret");
place(comment, L.comment.x, L.comment.y, L.comment.w, L.comment.h);
comment.style.borderRadius = `${L.comment.h / 2}px`;
function drawCTA(t) {
  const dt = P.cta ? t - P.cta.t : -1, out = ctaOut(t);
  win.style.opacity = String(1 - out);
  win.style.transform = `translateY(${(30 * out).toFixed(2)}px)`;
  if (dt < 0) return (comment.style.opacity = "0");
  comment.style.opacity = String(clamp(dt / 0.15));
  comment.style.transform = `scale(${(0.7 + 0.3 * spring(clamp(dt / 0.5))).toFixed(4)})`;
  said.textContent = [...P.cta.word].slice(0, Math.floor(Math.max(0, dt - 0.3) * 15)).join("");
  ctaCaret.style.opacity = Math.floor(t * 2) % 2 ? "0" : "1";
}

const cap = $("cap"), drawCaption = captionDrawer(cap, P);
place(cap, L.caption.x, L.caption.y, L.caption.w);
cap.style.fontSize = `${L.caption.size}px`;

function renderAt(t) {
  crossfade(titles, titleItems, t);
  crossfade(subs, subItems, t);
  const scope = Object.fromEntries(rows.filter((r) => r.kind === "slider" && r.start <= t).map((s) => [s.name, valueAt(s, t).v]));
  rows.forEach((r, i) => {
    if (r.kind === "line") curves[i].setAttribute("d", t >= r.draw ? graphPath(r.node, scope, VIEW, GW, GH, smooth(clamp((t - r.draw) / DRAW))) : "");
  });
  slots.forEach((slot, i) => drawRow(rows[i], slot, t));
  drawTap(t);
  drawCursor(t);
  drawFlower(t);
  drawCTA(t);
  drawCaption(t);
}

window.__renderAt = renderAt;
renderAt(window.__lastT || 0);

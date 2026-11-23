// Plan rules for the calculator: what a beat may do, and whether it fits the window and the clock.
import { fileURLToPath } from "node:url";
import { tokens, typeSteps, parseLine, freeVars } from "../../shared/math.js";
import { missing, textWidth } from "../../scripts/lib/fonts.mjs";
import { LAYOUT, ROWS, TYPE_RATE, DRAW, VIEW, squareView } from "./template/layout.js";

const stix = fileURLToPath(new URL("../../fonts/STIXTwoText-Italic[wght].ttf", import.meta.url));
const mathW = (s, px) => textWidth(s, { file: stix, factor: 1.08 }, px);
const ACTIONS = ["type", "slider", "drag", "tap"];

export default function check(beats, plan, { fontPath }) {
  const errors = [];
  if (plan.app !== "calculator") errors.push('"app" must be "calculator" (the only app so far)');
  let view = VIEW;
  if (plan.view !== undefined) {
    const v = plan.view;
    if (Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) && v[0] < v[1] && v[2] < v[3]) view = v;
    else errors.push('"view" is [x0, x1, y0, y1] with x0 < x1 and y0 < y1');
  }
  const shown = squareView(view), wide = shown[1] - shown[0] > 3 * (view[1] - view[0]), tall = shown[3] - shown[2] > 3 * (view[3] - view[2]);
  if (wide || tall) {
    const [a, b] = (wide ? shown.slice(0, 2) : shown.slice(2)).map((x) => +x.toFixed(2));
    errors.push(`"view" [${view.join(", ")}] would show ${wide ? "x" : "y"} from ${a} to ${b} to keep square units: pick ranges about twice as wide as tall, like [-10, 10, -5, 5]`);
  }
  const [x0, x1, y0, y1] = view;
  const sliders = {}; // letter -> {min, max} as set so far
  const everSlider = new Set(beats.map((b) => b.slider).filter(Boolean));
  let rows = 0;

  beats.forEach((b, i) => {
    if (b.object === "comment") return; // the CTA
    const n = i + 1;
    const lines = b.type === undefined ? [] : [b.type].flat().map(String);
    const acts = ACTIONS.filter((a) => b[a] !== undefined);
    if (acts.length > 1) errors.push(`beat ${n}: give each beat one thing to do (it has ${acts.join(" and ")})`);
    if (!acts.length && b.title === undefined && b.sub === undefined && b.answer === undefined)
      errors.push(`beat ${n}: give it something to do: type, slider, drag or tap, or a title, sub or answer`);

    // letters side by side multiply, so a word or a function name would draw as a product of letters
    const wordy = (s) => {
      const w = s.match(/[A-Za-z]{3,}/)?.[0];
      if (w) errors.push(`beat ${n}: "${w}" reads as ${[...w].join("·")}: maths fields take single letters (kx is k times x), no functions yet; put words in "sub"`);
      return w;
    };
    const maths = (s, wide) => {
      try { tokens(s); } catch { return errors.push(`beat ${n}: the ${wide} is maths only, like "y = 3x + 5"; put words in "sub"`); }
      wordy(s);
    };
    const title = b.title === undefined ? [] : [b.title].flat().map(String);
    title.forEach((s) => maths(s, "title"));
    if (title.length) {
      const w = title.reduce((a, s) => a + mathW(s, LAYOUT.title.size), 0) + (title.length - 1) * 1.5 * LAYOUT.title.size;
      if (w > 820) errors.push(`the title "${title.join("  ")}" is too wide (${Math.round(w)} px of 820): shorten it`);
    }
    for (const [k, max] of [["sub", 40], ["answer", 24]]) {
      if (b[k] === undefined) continue;
      if ([...String(b[k])].length > max) errors.push(`beat ${n}: the ${k} "${b[k]}" is too long (${[...String(b[k])].length} of ${max} characters)`);
      const bad = missing(String(b[k]), fontPath);
      if (bad.length) errors.push(`beat ${n}: the font can't draw "${bad.join("")}" (in the ${k}): take it out`);
    }

    rows += lines.length;
    let time = 0;
    for (const l of lines) {
      let node;
      if (wordy(l)) continue;
      try { node = parseLine(l); time += typeSteps(l) / TYPE_RATE; } catch (e) { errors.push(`beat ${n}: ${e.message}`); continue; }
      const w = mathW(l, LAYOUT.row.mathSize), max = LAYOUT.window.w - 120;
      if (w > max) errors.push(`the line "${l}" is too wide for a row (${Math.round(w)} px of ${max}): shorten it`);
      for (const v of freeVars(node)) if (!everSlider.has(v)) errors.push(`the line "${l}" uses ${v}: add a slider for ${v}`);
    }
    if (lines.length) {
      const room = (beats[i + 1]?.t ?? Infinity) - 0.3 - b.t;
      if (time + DRAW > room)
        errors.push(`beat ${n}: typing "${lines[0]}" takes ${(time + DRAW).toFixed(1)} s to type, but the next beat comes ${(room + 0.3).toFixed(1)} s later: move the next beat to a later word or split the lines`);
    }

    if (b.slider !== undefined) {
      rows++;
      const s = { min: b.min ?? -10, max: b.max ?? 10 };
      if (sliders[b.slider]) errors.push(`beat ${n}: ${b.slider} already has a slider`); // the page drags the first one
      else {
        sliders[b.slider] = s;
        if (!(s.min < s.max)) errors.push(`beat ${n}: the slider for ${b.slider} needs min below max`);
        else if (b.value !== undefined && !(Number.isFinite(b.value) && b.value >= s.min && b.value <= s.max))
          errors.push(`beat ${n}: ${b.slider} starts at ${JSON.stringify(b.value)}, but its slider goes from ${s.min} to ${s.max}`);
      }
    }
    if (b.drag !== undefined) {
      const s = sliders[b.drag];
      if (!s) errors.push(`beat ${n}: drag "${b.drag}" needs a slider for ${b.drag} on an earlier beat`);
      else if (!(b.to >= s.min && b.to <= s.max)) errors.push(`beat ${n}: drag "${b.drag}" to ${b.to}, but ${b.drag} goes from ${s.min} to ${s.max}`);
    }
    if (b.tap !== undefined) {
      const [x, y] = Array.isArray(b.tap) ? b.tap : [];
      if (!(Array.isArray(b.tap) && b.tap.length === 2 && b.tap.every(Number.isFinite))) errors.push(`beat ${n}: "tap" is [x, y] with two numbers`);
      else if (!(x >= x0 && x <= x1 && y >= y0 && y <= y1))
        errors.push(`beat ${n}: the tap (${x}, ${y}) is outside the graph (x ${x0} to ${x1}, y ${y0} to ${y1})`);
    }
  });
  if (rows > ROWS) errors.push(`the calculator shows ${ROWS} rows; this plan adds ${rows}`);
  return { errors, data: { app: "calculator", view } };
}

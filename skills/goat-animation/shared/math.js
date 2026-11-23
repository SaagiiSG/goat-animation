// Equations for the App Explainer: read, show as HTML, evaluate, draw as an SVG path.
// No imports, so the Node checker and the browser page use the same file.

export function tokens(src) {
  const out = [], re = /\s+|(\d+(?:\.\d+)?)|([A-Za-z])|(\^)|(\()|(\))|(=)|([+\-*/])|(\?)/y;
  const kinds = [null, "num", "var", "pow", "lp", "rp", "eq", "op", "q"];
  while (re.lastIndex < src.length) {
    const at = re.lastIndex, m = re.exec(src);
    if (!m) throw new Error(`can't read "${src[at]}" in "${src}"`);
    const i = m.findIndex((v, k) => k && v !== undefined);
    if (i > 0) out.push({ kind: kinds[i], text: m[0] });
  }
  return out;
}

export const typeSteps = (src) => tokens(src).filter((t) => t.kind !== "pow").length;

// The first n shown tokens (a "^" shows with the thing it raises, so it doesn't count).
export function mathHTML(src, n = Infinity) {
  const all = tokens(src), toks = [];
  for (let i = 0, shown = 0; i < all.length && shown < n; i++) {
    toks.push(all[i]);
    if (all[i].kind !== "pow") shown++;
  }
  const thin = " ", one = (t) => (t.kind === "var" ? `<i>${t.text}</i>` : t.text);
  const run = (ts) => {
    let h = "", prev = null;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.kind === "pow") {
        let j = i + 1;
        if (ts[j]?.text === "-") j++;
        let end = j + 1;
        if (ts[j]?.kind === "lp") for (let d = 0; end <= ts.length; end++) {
          if (ts[end - 1].kind === "lp") d++;
          if (ts[end - 1].kind === "rp" && --d === 0) break;
        }
        if (j < ts.length) h += `<sup>${run(ts.slice(i + 1, Math.min(end, ts.length)))}</sup>`;
        i = Math.min(end, ts.length) - 1;
      } else if (t.kind === "op" || t.kind === "eq") {
        const unary = !prev || ["op", "eq", "lp", "pow"].includes(prev.kind);
        const s = t.text === "-" ? "−" : t.text === "*" ? "·" : t.text;
        h += unary || t.text === "/" || t.text === "*" ? s : thin + s + thin;
      } else h += one(t);
      prev = ts[i]; // after a ^ that is the exponent's last token, so a following + - = is binary
    }
    return h;
  };
  return run(toks);
}

// expr := term (("+"|"-") term)*; term := unary (("*"|"/")? unary)* (implicit multiply before num, var, "(");
// unary := "-" unary | power; power := atom ("^" unary)?; atom := num | var | "(" expr ")"
function parser(src, start = 0) {
  const ts = tokens(src);
  let p = start;
  const peek = () => ts[p], is = (k, x) => ts[p]?.kind === k && (x === undefined || ts[p].text === x);
  const soon = () => new Error(`"${src}" ends too soon, after "${ts[ts.length - 1].text}"`);
  const expr = () => {
    let a = term();
    while (is("op", "+") || is("op", "-")) a = { t: "bin", op: ts[p++].text, a, b: term() };
    return a;
  };
  const term = () => {
    let a = unary();
    for (;;) {
      if (is("op", "*") || is("op", "/")) a = { t: "bin", op: ts[p++].text, a, b: unary() };
      else if (is("num") || is("var") || is("lp")) a = { t: "bin", op: "*", a, b: unary() };
      else return a;
    }
  };
  const unary = () => (is("op", "-") ? (p++, { t: "neg", a: unary() }) : power());
  const power = () => {
    const a = atom();
    return is("pow") ? (p++, { t: "bin", op: "^", a, b: unary() }) : a;
  };
  const atom = () => {
    const t = peek();
    if (!t) throw soon();
    if (t.kind === "num") return p++, { t: "num", v: Number(t.text) };
    if (t.kind === "var") return p++, { t: "var", n: t.text };
    if (t.kind === "lp") {
      p++;
      const e = expr();
      if (!is("rp")) throw new Error(`a "(" in "${src}" isn't closed`);
      return p++, e;
    }
    throw new Error(`can't make sense of "${t.text}" in "${src}"`);
  };
  return () => {
    if (start === 0 && !ts.length) throw new Error(`"${src}" is empty`);
    const e = expr();
    if (p < ts.length) throw new Error(`can't make sense of "${ts[p].text}" in "${src}"`);
    return e;
  };
}

export const parseExpr = (src) => parser(src)();

export function parseLine(src) {
  const ts = tokens(src);
  if (ts[0]?.text !== "y" || ts[1]?.kind !== "eq") throw new Error('a line must start with "y =", like "y = 3x + 5"');
  return parser(src, 2)();
}

const ops = { "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b, "/": (a, b) => a / b, "^": (a, b) => a ** b };
export function evaluate(n, scope) {
  if (n.t === "num") return n.v;
  if (n.t === "var") return typeof scope[n.n] === "number" ? scope[n.n] : NaN;
  if (n.t === "neg") return -evaluate(n.a, scope);
  return ops[n.op](evaluate(n.a, scope), evaluate(n.b, scope));
}

export function freeVars(n, out = new Set()) {
  if (n.t === "var" && n.n !== "x") out.add(n.n);
  else if (n.a) { freeVars(n.a, out); if (n.b) freeVars(n.b, out); }
  return [...out].sort();
}

// SVG path "d" of the curve in a width x height box showing view [x0, x1, y0, y1], drawn from x0 to `upTo` of the way across.
export function graphPath(node, scope, [x0, x1, y0, y1], width, height, upTo = 1) {
  let d = "", prev = NaN, px = NaN;
  for (let i = 0; i < 240; i++) {
    const x = x0 + (upTo * (x1 - x0) * i) / 239, y = evaluate(node, { ...scope, x });
    if (!Number.isFinite(y)) { prev = NaN; continue; }
    // a sign flip whose midpoint isn't between its neighbours is an asymptote (1/x shoots past both); a curve through
    // zero (1000x, x^2 - 4) keeps its midpoint between them. A same-sign jump only joins two off-screen points
    const mid = y * prev < 0 ? evaluate(node, { ...scope, x: (x + px) / 2 }) : NaN;
    const jump = !Number.isFinite(prev) || (y * prev < 0 && !(mid >= Math.min(y, prev) && mid <= Math.max(y, prev)));
    d += `${jump ? "M" : "L"}${(((x - x0) / (x1 - x0)) * width).toFixed(1)} ${((1 - (y - y0) / (y1 - y0)) * height).toFixed(1)}`;
    prev = y;
    px = x;
  }
  return d;
}

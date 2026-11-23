// Captions for every page: each group's own words, in order, so each word fades in on its own time. No imports.
const clamp = (v) => Math.min(1, Math.max(0, v));

export function captionDrawer(cap, P) {
  let wi = 0;
  for (const g of P.captions) {
    g.words = [];
    while (wi < P.words.length && g.words.map((w) => w.text).join(" ").length < g.text.length) g.words.push(P.words[wi++]);
  }
  let shown = null;
  return (t) => {
    // the last group that has started, while it is on or fading out
    const last = P.captions.findLast((c) => c.start <= t), g = last && t < last.end + 0.12 ? last : null;
    if (g !== shown) {
      cap.replaceChildren(...(g ? g.words.map((w) => Object.assign(document.createElement("span"), { textContent: w.text, className: w.stress ? "hot" : "" })) : []));
      shown = g;
    }
    if (!g) return;
    const out = t > g.end ? clamp((g.end + 0.12 - t) / 0.12) : 1;
    g.words.forEach((w, i) => {
      const o = clamp((t - w.start) / 0.18);
      cap.children[i].style.opacity = String(o * out);
      cap.children[i].style.filter = `blur(${(4 * (1 - o)).toFixed(2)}px)`;
    });
  };
}

// Shared by the page (browser) and the plan checker (node): no imports.
export const LAYOUT = {
  title: { cx: 540, y: 330, size: 56 },
  sub: { cx: 540, y: 410, size: 30 },
  window: { x: 140, y: 460, w: 800, h: 700 },
  graph: { h: 400 },
  toolbar: { h: 52 },
  row: { h: 62, mathSize: 40 },
  caption: { x: 140, w: 660, y: 1215, size: 32 },
  flower: { x: 820, y: 1100, size: 130 },
  comment: { x: 160, y: 755, w: 760, h: 110 }, // centred where the window was: it takes the window's place on the CTA
};
export const ROWS = 4;
export const TYPE_RATE = 16; // tokens per second
export const DRAW = 0.5; // seconds for a line to draw
export const VIEW = [-10, 10, -5, 5]; // square units in the 800 x 400 graph
export const COLORS = ["#c74440", "#388c46", "#6042a6", "#000000"];
// square units, like a real calculator: the plan's view is the least the graph shows; the short side widens about its centre
export function squareView([a, b, c, d]) {
  const w = LAYOUT.window.w, h = LAYOUT.graph.h, u = Math.max((b - a) / w, (d - c) / h), mx = (a + b) / 2, my = (c + d) / 2;
  return [mx - (u * w) / 2, mx + (u * w) / 2, my - (u * h) / 2, my + (u * h) / 2];
}

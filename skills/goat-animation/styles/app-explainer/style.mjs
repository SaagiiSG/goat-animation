// A graphing calculator on paper: lines typed, sliders dragged, one answer.
import check from "./check.mjs";

export default {
  name: "app-explainer",
  objects: null,
  minBeat: 1.0,
  captions: { maxWords: 5, maxChars: 30 },
  font: "Inter",
  cta: { size: 48, max: 520 },
  check,
};

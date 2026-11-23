// Grey paper, a halftone cut-out per idea, the brand's colour in flat shapes, words slamming in big and small.
import wireframe from "../wireframe/style.mjs";
import check from "./check.mjs";

export default {
  name: "collage",
  objects: wireframe.objects,
  minBeat: 1.2,
  captions: { maxWords: 6, maxChars: 30 },
  font: "Oswald",
  cta: { size: 160, max: 820 },
  stress: true,
  photos: true,
  check,
};

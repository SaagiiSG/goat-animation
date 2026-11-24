// Comic action: each idea a comic panel, inked and halftoned; the voice's lines in narration boxes and speech bubbles,
// the user's own paper figure as the hero, sound words and impact frames on the hits.
import wireframe from "../wireframe/style.mjs";
import check from "./check.mjs";

export default {
  name: "comic",
  objects: wireframe.objects,
  objectOptional: true,
  minBeat: 1.5,
  captions: { maxWords: 6, maxChars: 32 },
  font: "ShantellSans",
  stress: true,
  check,
};

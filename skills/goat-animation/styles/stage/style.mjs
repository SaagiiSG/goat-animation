// Solid objects on a lit stage, a paper-cut narrator (or two) beside them; the stage goes dark at the turn.
import wireframe from "../wireframe/style.mjs";
import check from "./check.mjs";

export default {
  name: "stage",
  objects: wireframe.objects,
  minBeat: 1.5,
  captions: { maxWords: 6, maxChars: 34 },
  font: "Inter",
  cta: { size: 46, max: 330 },
  stress: true,
  check,
};

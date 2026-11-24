// Plan rules for Comic: what a panel can show (an object, a villain, the hero), counts as columns, sound words.
import { fileURLToPath } from "node:url";
import { loadFigure } from "../../scripts/lib/figure.mjs";
import { missing } from "../../scripts/lib/fonts.mjs";

const SFX_FONT = fileURLToPath(new URL("../../fonts/ScienceGothic[CTRS,slnt,wdth,wght].ttf", import.meta.url));
const HERO = ["face", "point", "think"];

export default function check(beats, plan, { planDir }) {
  const errors = [], narrators = [];
  if (plan.narrator !== undefined) {
    if (Array.isArray(plan.narrator)) errors.push('Comic has one hero: "narrator" is one figure file, like "figure.json"');
    else {
      const r = loadFigure(String(plan.narrator), planDir);
      errors.push(...r.errors);
      if (r.figure) narrators.push(r.figure);
    }
  }
  beats.forEach((b, i) => {
    const n = `beat ${i + 1}`;
    if (b.cta) return; // the comment ending
    if (b.hero !== undefined && !HERO.includes(b.hero)) errors.push(`${n}: "hero" is one of: ${HERO.join(", ")}`);
    if (b.hero !== undefined && !narrators.length && plan.narrator === undefined) errors.push(`${n}: the hero needs "narrator": the user's figure file (step 3b)`);
    if (b.hero === undefined && b.object === undefined) errors.push(`${n}: give it an "object", or "hero" for the hero (a close-up needs no object)`);
    if (b.villain !== undefined && (b.villain !== true || b.object === undefined || b.hero !== undefined)) errors.push(`${n}: "villain": true goes on an object panel, without "hero"`);
    if (b.count !== undefined && (b.count > 3 || b.hero !== undefined || b.villain)) errors.push(`${n}: "count" is 2 or 3 copies of an object (they stand in columns), not on a hero or villain`);
    if (b.impact !== undefined && typeof b.impact !== "boolean") errors.push(`${n}: "impact" is true or false`);
    if (b.impact && b.t < 0.3) errors.push(`${n}: an impact can't open the video (its first frame is the thumbnail): put it on a later beat`);
    if (b.sfx !== undefined) {
      const s = String(b.sfx);
      if (!s.trim() || [...s].length > 8) errors.push(`${n}: the sound word "${s}" must be 1 to 8 characters, like "ТАС!" or "ШУУ!"`);
      const bad = missing(s, SFX_FONT);
      if (bad.length) errors.push(`${n}: the sound word font can't draw "${bad.join("")}" (in "${s}")`);
    }
  });
  return { errors, data: { narrators } };
}

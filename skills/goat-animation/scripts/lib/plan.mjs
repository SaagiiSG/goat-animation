// plan.json: styles and brands by name, beats and sounds put on their words, and every rule a render needs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SOUNDS } from "./sound.mjs";
import { missing, textWidth } from "./fonts.mjs";
import { scriptWords } from "./timing.mjs";

export const SKILL_DIR = fileURLToPath(new URL("../../", import.meta.url));
const norm = (s) => s.toLowerCase().replace(/[\p{P}\p{S}]/gu, "");
const s2 = (x) => `${x.toFixed(2)}s`;

export async function loadStyle(name, skillDir = SKILL_DIR) {
  const file = join(skillDir, "styles", String(name), "style.mjs");
  if (!existsSync(file)) {
    const all = readdirSync(join(skillDir, "styles")).filter((d) => existsSync(join(skillDir, "styles", d, "style.mjs")));
    throw new Error(`unknown style "${name}". Styles: ${all.join(", ")}`);
  }
  return (await import(pathToFileURL(file))).default;
}

export function loadBrand(name, skillDir = SKILL_DIR) {
  const file = join(skillDir, "brands", `${name}.json`);
  if (!existsSync(file)) {
    const all = readdirSync(join(skillDir, "brands")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    throw new Error(`unknown brand "${name}". Brands: ${all.join(", ")}`);
  }
  const brand = JSON.parse(readFileSync(file, "utf8"));
  if (brand.mark) {
    const mark = join(skillDir, "brands", brand.mark);
    if (!existsSync(mark)) throw new Error(`brand "${name}" names a mark file "${brand.mark}" that isn't in brands/`);
    brand.markSvg = readFileSync(mark, "utf8");
  }
  return brand;
}

// Index of the first word of `say` (several words in a row) at or after `from`, or -1.
export function findSay(words, say, from) {
  const want = scriptWords(say).map(norm).filter(Boolean), have = words.map((w) => norm(w.text));
  if (!want.length) return -1; // only punctuation: there's nothing to find
  for (let i = from; i + want.length <= have.length; i++) if (want.every((x, k) => have[i + k] === x)) return i;
  return -1;
}

export function resolvePlan(plan, words, style, { end, fontPath, monoPath, planDir = "." }) {
  const errors = [], stress = []; // stress: the words a beat's `say` names (Stage and Collage set them apart)
  // each list keeps its own place in the words, so `say`s are found in order
  const placer = (label) => {
    let from = 0;
    return (item, n, mark = false) => {
      if (typeof item.at === "number") return item.at;
      if (typeof item.say !== "string" || !item.say.trim()) {
        errors.push(`${label(n)}give it "say" (words from the captions) or "at" (seconds)`);
        return null;
      }
      const i = findSay(words, item.say, from);
      if (i < 0) {
        errors.push(`${label(n)}"${item.say}" isn't in the words. Around there they say: "${words.slice(from, from + 8).map((w) => w.text).join(" ")}"`);
        return null;
      }
      from = i + 1;
      if (mark) for (let k = 0; k < Math.max(1, scriptWords(item.say).map(norm).filter(Boolean).length); k++) stress.push(i + k);
      return words[i].start;
    };
  };

  if (style.objects && !plan.beats?.length) errors.push('the plan has no beats: add at least one, starting with "at": 0');
  const onBeat = placer((n) => `beat ${n}: `);
  const beats = [];
  (plan.beats ?? []).forEach((b, k) => {
    // a style that prints photos (Collage) takes the user's own picture in place of an object
    if (b.photo !== undefined && !style.photos) errors.push(`beat ${k + 1}: "photo" only works in Collage; pick an object instead`);
    else if (b.photo !== undefined && b.object !== undefined) errors.push(`beat ${k + 1}: give it an "object" or a "photo", not both`);
    // a style may let a beat show no object (Comic: a close-up of the hero)
    else if (style.objects && b.photo === undefined && !(style.objectOptional && b.object === undefined) && !style.objects.includes(b.object))
      errors.push(`beat ${k + 1}: object "${b.object}" isn't in the ${style.name} library. Pick one of: ${style.objects.join(", ")}`);
    if (b.count !== undefined && !(Number.isInteger(b.count) && b.count >= 1 && b.count <= 6))
      errors.push(`beat ${k + 1}: count must be a whole number from 1 to 6 (it is ${JSON.stringify(b.count)})`);
    // a terminal types its lines (mono font, falling back to Inter for ✓); any object can carry a small tag
    if (b.lines !== undefined) {
      const lines = Array.isArray(b.lines) ? b.lines.map(String) : [String(b.lines)];
      if (b.object !== "terminal") errors.push(`beat ${k + 1}: "lines" only goes on a terminal`);
      else if (lines.length > 5) errors.push(`beat ${k + 1}: a terminal shows 5 lines at most (this one has ${lines.length})`);
      for (const l of lines) {
        if ([...l].length > 30) errors.push(`beat ${k + 1}: the line "${l}" is too long for the terminal (${[...l].length} of 30 characters)`);
        const bad = missing(l, monoPath).filter((ch) => missing(ch, fontPath).length);
        if (bad.length) errors.push(`the terminal font can't draw "${bad.join("")}" (in "${l}"): take it out`);
      }
    }
    if (b.tag !== undefined && [...String(b.tag)].length > 16)
      errors.push(`beat ${k + 1}: the tag "${b.tag}" is too long (${[...String(b.tag)].length} of 16 characters): keep it to one or two words`);
    const badTag = b.tag === undefined ? [] : missing(String(b.tag), monoPath).filter((ch) => missing(ch, fontPath).length);
    if (badTag.length) errors.push(`the tag font can't draw "${badTag.join("")}" (in "${b.tag}"): take it out`);
    const t = onBeat(b, k + 1, true);
    if (t !== null) {
      const { say, at, ...own } = b; // a style's own beat fields travel on to its page
      beats.push({ t, ...own, ...(b.lines !== undefined && { lines: [b.lines].flat().map(String) }), ...(b.tag !== undefined && { tag: String(b.tag) }) });
    }
  });
  let cta = null;
  if (plan.cta) {
    const t = onBeat(plan.cta, "CTA");
    if (t !== null) {
      cta = { t, word: String(plan.cta.word ?? "").trim() };
      if (!/[\p{L}\p{N}]/u.test(cta.word)) errors.push('the CTA needs a "word": what people comment, like "GOAT"');
      // the style says how wide the word may be (Wireframe: 330 px of the comment box before the send arrow)
      const w = style.cta ? textWidth(cta.word, { file: fontPath, factor: 1.06 }, style.cta.size) : 0;
      if (style.cta && w > style.cta.max)
        errors.push(`the CTA word "${cta.word}" is too wide for the comment box (${Math.round(w)} px of ${style.cta.max}): use a shorter word, about 7 capitals at most`);
      beats.push({ t, object: "comment", cta: true });
    }
  }
  beats.sort((a, b) => a.t - b.t);
  if (beats.length && beats[0].t > 0.5) errors.push(`the first beat starts at ${s2(beats[0].t)}; start one at 0 so the first frame isn't empty`);
  for (let i = 0; i + 1 < beats.length; i++) {
    const d = beats[i + 1].t - beats[i].t;
    if (d < style.minBeat)
      errors.push(`beats ${i + 1} and ${i + 2} are ${s2(d)} apart; each needs at least ${style.minBeat}s: drop one or move it to a later word`);
  }
  if (beats.length && end - beats.at(-1).t < style.minBeat)
    errors.push(`the last beat starts ${s2(end - beats.at(-1).t)} before the end; it needs ${style.minBeat}s: move it earlier or drop it`);

  const onSound = placer((n) => `sound ${n}: `);
  const sounds = [];
  (plan.sounds ?? []).forEach((s, k) => {
    if (!SOUNDS.includes(s.sound)) return errors.push(`unknown sound "${s.sound}". Choose from: ${SOUNDS.join(", ")}`);
    const at = onSound(s, k + 1);
    if (at !== null) sounds.push({ at, sound: s.sound });
  });
  sounds.sort((a, b) => a.at - b.at);
  for (let i = 0; i + 1 < sounds.length; i++)
    if (sounds[i + 1].at - sounds[i].at < 0.5) errors.push(`sounds at ${s2(sounds[i].at)} and ${s2(sounds[i + 1].at)} are under 0.5s apart: drop one`);

  for (const w of words) {
    const bad = missing(w.text, fontPath);
    if (bad.length) errors.push(`the caption font can't draw "${bad.join("")}" (in "${w.text}"): take it out of the script`);
  }
  const checked = style.check?.(beats, plan, { end, fontPath, monoPath, words, planDir });
  if (checked?.errors) errors.push(...checked.errors);
  return { beats, sounds, cta, errors, stress, data: checked?.data ?? {} };
}

// Word times for the video: the script lined up on the voice, by sentence when that fails, or by reading speed.
import { transcribe } from "./words.mjs";
import { alignScript } from "./voice.mjs";
import { speech } from "./media.mjs";

const END = /[.!?…]$/;
const letters = (w) => (w.match(/[\p{L}\p{N}]/gu) ?? []).length || 1;

// The script's words, with a number group like "25 000₮" kept as one word (alignScript's rule).
export function scriptWords(script) {
  const texts = [];
  for (const t of script.split(/\s+/).filter(Boolean)) {
    if (/\d$/.test(texts.at(-1) ?? "") && /^\d{3}(?!\d)/.test(t)) texts[texts.length - 1] += ` ${t}`;
    else texts.push(t);
  }
  return texts;
}

export function readingTimes(script, { lettersPerSec = 13, start = 0.3, sentenceGap = 0.4 } = {}) {
  let t = start;
  return scriptWords(script).map((text) => {
    const w = { text, start: t, end: t + letters(text) / lettersPerSec };
    t = w.end + (END.test(text) ? sentenceGap : 0);
    return w;
  });
}

// Words spread by length over the speech spans laid end to end, so no word starts inside a pause.
export function sentenceTimes(script, spans) {
  const words = scriptWords(script), clock = spans.reduce((s, [a, b]) => s + b - a, 0);
  const total = words.reduce((s, w) => s + letters(w), 0);
  const at = (c, inclusive) => {
    let acc = 0;
    for (const [a, b] of spans) {
      if (inclusive ? c <= acc + b - a : c < acc + b - a) return a + (c - acc);
      acc += b - a;
    }
    return spans.at(-1)[1];
  };
  let done = 0;
  return words.map((text) => {
    const c0 = (clock * done) / total;
    done += letters(text);
    return { text, start: at(c0, false), end: at((clock * done) / total, true) };
  });
}

// A voice memo often starts with a second or two of nothing: the video starts 0.25 s before the first word instead.
export function trimLead(timing) {
  const lead = timing.words[0].start > 0.4 ? timing.words[0].start - 0.25 : 0;
  if (!lead) return { ...timing, lead };
  const words = timing.words.map((w) => ({ ...w, start: w.start - lead, end: w.end - lead }));
  return { ...timing, words, end: timing.end - lead, lead };
}

export async function timeWords({ script, voice, language, workDir }, deps = { transcribe, alignScript, speech }) {
  const done = (words, mode, note) => ({ words, mode, end: words.at(-1).end, ...(note && { note }) });
  if (!voice) return done(readingTimes(script), "reading");
  const heard = await deps.transcribe(voice, workDir, language);
  if (heard.length < 2) throw new Error(`no speech found in ${voice}: is it the right file?`);
  try {
    return done(deps.alignScript(script, heard), "aligned");
  } catch (e) {
    const pct = Number(/\((\d+)% /.exec(e.message)?.[1]);
    if (Number.isNaN(pct)) throw e;
    if (pct < 20) throw new Error(`the script doesn't match the voice (${pct}%): is it the right file?`);
    return done(sentenceTimes(script, await deps.speech(voice)), "sentences",
      `the script only matches ${pct}% of the voice, so captions are timed by sentence. Check the script is what was said.`);
  }
}

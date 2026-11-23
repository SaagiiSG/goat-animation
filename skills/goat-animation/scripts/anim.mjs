#!/usr/bin/env node
// goat-animation: node anim.mjs check [--voice] | time plan.json | render plan.json | figure figure.json
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { run, ffmpeg, sheet } from "./lib/media.mjs";
import { whisperPlaces, groupCaptions } from "./lib/words.mjs";
import { readScript } from "./lib/voice.mjs";
import { missingTools } from "./lib/setup.mjs";
import { timeWords, trimLead } from "./lib/timing.mjs";
import { SKILL_DIR, loadBrand, loadStyle, resolvePlan } from "./lib/plan.mjs";
import { buildProject } from "./lib/build.mjs";
import { renderProject, mux, checkFirstFrame } from "./lib/render.mjs";
import { mixSound } from "./lib/sound.mjs";
import { loadFigure } from "./lib/figure.mjs";
import { hf } from "./lib/hf.mjs";

const [cmd, ...args] = process.argv.slice(2);

async function check() {
  const found = {};
  for (const c of ["ffmpeg"]) found[c] = await run(c, ["-version"]).then((r) => r.code === 0, () => false);
  const lines = missingTools({ nodeVersion: process.version, has: (c) => found[c], whisperFound: whisperPlaces().some((p) => existsSync(p)),
    voice: args.includes("--voice") });
  for (const l of lines) console.log(`[anim] ${l}`);
  if (lines.length) process.exit(1);
  console.log("[anim] ready");
}

function loadPlan(path) {
  if (!path || !existsSync(path)) throw new Error(`plan file not found: ${path ?? "(none given)"}`);
  const planPath = resolve(path), planDir = dirname(planPath);
  const plan = JSON.parse(readFileSync(planPath, "utf8").replace(/^\uFEFF/, "")); // a BOM from Windows Notepad
  const script = readScript(plan, planDir);
  if (!script) throw new Error('the plan needs a "script": the words, or a .txt file with them');
  const voice = plan.voice ? resolve(planDir, plan.voice) : null;
  if (voice && !existsSync(voice)) throw new Error(`the voice file ${plan.voice} is missing (looked for ${voice})`);
  const work = join(planDir, ".work-anim");
  mkdirSync(work, { recursive: true });
  return { plan, planPath, planDir, script, voice, work };
}

// words.json is reused while the script, voice and language are the ones it was timed from
async function timePlan(p, reuse = false) {
  const key = JSON.stringify([p.script, p.voice, p.voice && statSync(p.voice).mtimeMs, p.plan.language ?? "mn"]);
  const file = join(p.work, "words.json");
  if (reuse && existsSync(file)) {
    const old = JSON.parse(readFileSync(file, "utf8"));
    if (old.key === key) return trimLead(old);
  }
  const timing = { ...(await timeWords({ script: p.script, voice: p.voice, language: p.plan.language ?? "mn", workDir: p.work })), key };
  writeFileSync(file, JSON.stringify(timing, null, 1));
  console.log(`[anim] timing: ${timing.mode}`);
  if (timing.note) console.log(`[anim] note: ${timing.note}`);
  const trimmed = trimLead(timing);
  if (trimmed.lead) console.log(`[anim] note: the ${trimmed.lead.toFixed(2)} s of silence before the first word is cut; the times below are the video's`);
  return trimmed;
}

async function time() {
  const timing = await timePlan(loadPlan(args[0]));
  groupCaptions(timing.words).forEach((g, i) =>
    console.log(`${String(i + 1).padStart(3)}  ${g.start.toFixed(2)}–${g.end.toFixed(2)}  ${g.text}`));
}

async function render() {
  const p = loadPlan(args[0]);
  const style = await loadStyle(p.plan.style), brand = loadBrand(p.plan.brand ?? "goat");
  const timing = await timePlan(p, true), dur = timing.end + 0.6;
  const fonts = join(SKILL_DIR, "fonts");
  const fontPath = join(fonts, readdirSync(fonts).find((f) => f.startsWith(style.font) && f.endsWith(".ttf")));
  const r = resolvePlan(p.plan, timing.words, style, { end: dur, fontPath, monoPath: join(fonts, "JetBrainsMono[wght].ttf"), planDir: p.planDir });
  if (r.errors.length) {
    for (const e of r.errors) console.log(`[anim] ${e}`);
    process.exit(1);
  }
  const hfDir = buildProject({ styleDir: join(SKILL_DIR, "styles", style.name), sharedDir: join(SKILL_DIR, "shared"), fontsDir: fonts,
    outDir: join(p.work, "hf"), data: { dur, words: style.stress ? timing.words.map((w, i) => (r.stress.includes(i) ? { ...w, stress: true } : w)) : timing.words,
      captions: groupCaptions(timing.words, style.captions),
      beats: r.beats, cta: r.cta, ...r.data, brand, quality: p.plan.quality ?? "full", W: 1080, H: 1920 } });
  for (const m of r.data.media ?? []) { // the user's own pictures, copied next to the page
    mkdirSync(join(hfDir, dirname(m.to)), { recursive: true });
    copyFileSync(m.from, join(hfDir, m.to));
  }
  const silent = join(p.work, "silent.mp4"), sound = join(p.work, "sound.wav");
  console.log("[anim] rendering the picture (this can take a few minutes)");
  await renderProject(hfDir, silent);
  let bed = p.voice;
  if (bed && timing.lead) {
    bed = join(p.work, "voice-trimmed.wav");
    await ffmpeg(["-ss", timing.lead.toFixed(3), "-i", p.voice, "-vn", "-c:a", "pcm_s16le", bed], "cut the silence before the voice");
  }
  if (!bed) {
    bed = join(p.work, "silence.wav");
    await ffmpeg(["-f", "lavfi", "-t", dur.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo", bed], "make a silent sound track");
  }
  await mixSound({ bed, total: dur, voice: !!p.voice, music: p.plan.music ?? null, events: r.sounds, gain: 0.3,
    sfxDir: join(SKILL_DIR, "sfx"), out: sound, planDir: p.planDir });
  const outDir = join(p.planDir, "out"), name = p.plan.name ?? basename(p.planPath, ".json");
  mkdirSync(outDir, { recursive: true });
  const mp4 = join(outDir, `${name}.mp4`), jpg = join(outDir, `${name}-sheet.jpg`);
  await mux(silent, sound, mp4);
  await sheet(mp4, jpg);
  await checkFirstFrame(mp4);
  console.log(`[anim] video: ${mp4}`);
  console.log(`[anim] contact sheet: ${jpg}`);
}

// a picture of the member's paper figure (made from their photo), to check before it narrates a video
async function figure() {
  const file = args[0];
  if (!file || !file.endsWith(".json")) throw new Error("use: node anim.mjs figure figure.json");
  const { figure: fig, errors } = loadFigure(file, process.cwd());
  if (errors.length) {
    for (const e of errors) console.log(`[anim] ${e}`);
    process.exit(1);
  }
  const at = resolve(file), work = join(dirname(at), ".work-anim", "figure");
  const hfDir = buildProject({ styleDir: join(SKILL_DIR, "styles", "stage"), sharedDir: join(SKILL_DIR, "shared"), fontsDir: join(SKILL_DIR, "fonts"),
    outDir: join(work, "hf"), data: { dur: 2, words: [], captions: [], beats: [], cta: null, narrators: [fig], portrait: true,
      brand: loadBrand("goat"), quality: "full", W: 1080, H: 1920 } });
  const r = await hf(["snapshot", hfDir, "--at", "1.2", "--no-end", "-o", join(work, "snap")]);
  const png = join(work, "snap", "frame-00-at-1.2s.png");
  if (r.code || !existsSync(png)) throw new Error(`HyperFrames could not draw the figure:\n${(r.stdout + r.stderr).trim().slice(-1500)}`);
  const out = at.replace(/\.json$/, ".png");
  copyFileSync(png, out);
  console.log(`[anim] figure: ${out}`);
}

const commands = { check, time, render, figure };
if (!commands[cmd]) {
  console.log("[anim] use: node anim.mjs check [--voice] | time plan.json | render plan.json | figure figure.json");
  process.exit(1);
}
try {
  await commands[cmd]();
} catch (e) {
  console.error(`[anim] ${e.message}`);
  process.exit(1);
}

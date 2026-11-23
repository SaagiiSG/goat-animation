// Copied from goat-editing-skills core/render.mjs at 67b2cc1.
// Fill a look's HyperFrames template with the plan, render it, put the sound under it.
import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpeg, run } from "./media.mjs";
import { hf } from "./hf.mjs";
import { loudness } from "./sound.mjs";

export async function buildProject(ctx, data) {
  const { hfDir, skillDir, work, plan } = ctx;
  mkdirSync(hfDir, { recursive: true });
  cpSync(join(skillDir, "template"), hfDir, { recursive: true });
  if (existsSync(join(skillDir, "fonts"))) cpSync(join(skillDir, "fonts"), join(hfDir, "fonts"), { recursive: true });
  for (const f of ["goat-lib.js", "goat-visuals.js"]) cpSync(join(dirname(fileURLToPath(import.meta.url)), f), join(hfDir, f));
  cpSync(join(work, "cut.mp4"), join(hfDir, "main.mp4"));
  if (existsSync(join(work, "media"))) cpSync(join(work, "media"), join(hfDir, "media"), { recursive: true });
  // data.html fills {{KEY}} in index.html: HyperFrames finds <video> elements in the page's HTML, not ones look.js
  // adds later, so a look with one video per clip (PER_CLIP) writes them here
  const { html = {}, ...rest } = data ?? {};
  const index = join(hfDir, "index.html");
  let page = readFileSync(index, "utf8").replaceAll("{{DUR}}", ctx.dur.toFixed(3));
  for (const [key, value] of Object.entries(html)) page = page.replaceAll(`{{${key}}}`, () => value); // no $-patterns
  writeFileSync(index, page);
  const PLAN = { dur: ctx.dur, captions: ctx.captions, words: ctx.words, cuts: ctx.cuts ?? [], clips: ctx.clips ?? [],
    voice: !!ctx.voice, look: plan.look ?? {}, texts: plan.texts ?? [], ...rest };
  writeFileSync(join(hfDir, "plan.js"), `window.PLAN = ${JSON.stringify(PLAN)};\n`);
  return hfDir;
}

// 4 Chrome workers: the docs' sweet spot, and more than that can choke a laptop. 12 Mb/s peak: "delivery" alone left
// grainy looks at 33 Mb/s (223 MB for 54 s); 12M keeps a minute under ~90 MB, inside what Reels and TikTok take.
export const RENDER_ARGS = ["--sdr", "--quality", "delivery", "--max-bitrate", "12M", "--fps", "30", "--workers", "4"];

export async function renderProject(hfDir, outSilent) {
  const lint = await hf(["lint", hfDir]);
  const said = (lint.stdout + lint.stderr).trim();
  if (lint.code) throw new Error(`HyperFrames found problems in the template:\n${said.slice(-1500)}`);
  if (said.includes("⚠")) console.warn(said.slice(-1500));
  const r = await hf(["render", hfDir, "-o", outSilent, ...RENDER_ARGS]);
  if (r.code || !existsSync(outSilent))
    throw new Error(`HyperFrames could not render the video:\n${(r.stdout + r.stderr).trim().slice(-1500)}`);
}

// The posted file's true peak stays at -1.5 dBTP or under. The mix is limited to -2.5 dBFS, but AAC can overshoot a
// limited stretch by more than that 1 dB (a voice on the limiter under two effect tails came out at +1.3 dBTP, 17 Nov),
// so the encoded file is measured and, when it's over, encoded again lower. The overshoot isn't linear in the level
// (that mix 0.3 dB lower came out at -2.6 dBTP, 3.1 dB lower at -5.4 but 2 dB lower at -0.7), so the first retry is
// 0.3 dB, which keeps the loudness; after that, lower by the excess and 0.3 dB to spare.
export const TRUE_PEAK = -1.5;
export const peakTrim = (peak, limit = TRUE_PEAK, spare = 0.3) => (peak > limit ? Math.round((peak - limit + spare) * 10) / 10 : 0);

// Puts the sound under the video (the video copied). Returns how many dB the sound was lowered to keep its true peak.
export async function mux(silent, sound, out) {
  let down = 0;
  for (let pass = 1; ; pass++) { // four encodes at most
    await ffmpeg(["-i", silent, "-i", sound, "-map", "0:v", "-map", "1:a", "-c:v", "copy", ...(down ? ["-af", `volume=-${down}dB`] : []),
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], "put the sound under the video");
    const more = peakTrim((await loudness(out)).peak);
    if (!more || pass === 4) return down;
    down = Math.round((down + (pass === 1 ? 0.3 : more)) * 10) / 10;
  }
}

// Reels and TikTok take frame 0 as the thumbnail: warn when it is one flat colour.
export async function checkFirstFrame(video) {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", video, "-frames:v", "1",
    "-vf", "scale=108:192,format=gray", "-f", "rawvideo", "-"], { binary: true });
  if (stdout.length && Math.max(...stdout) - Math.min(...stdout) < 12)
    console.log("[goat] note: the first frame (the thumbnail) is empty: start the main text or footage at 0.");
}

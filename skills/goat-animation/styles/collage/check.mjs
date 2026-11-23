// Plan rules for Collage: a beat's "say" words are printed huge, so only a few fit; a beat can show the user's own
// photo instead of an object.
import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { scriptWords } from "../../scripts/lib/timing.mjs";

const KINDS = [".png", ".jpg", ".jpeg", ".webp"];

export default function check(beats, plan, { planDir = "." } = {}) {
  const errors = [], photos = {}, media = [];
  (plan.beats ?? []).forEach((b, k) => {
    const n = typeof b.say === "string" ? scriptWords(b.say).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
    if (n > 3) errors.push(`beat ${k + 1}: "say" has ${n} words, and Collage prints each one huge: keep it to the one to three words that carry the idea`);
    if (b.photo === undefined || String(b.photo) in photos) return;
    const name = String(b.photo), file = resolve(planDir, name), ext = extname(name).toLowerCase();
    if (ext === ".heic" || ext === ".heif") return errors.push(`beat ${k + 1}: ${name} is a HEIC photo, which the page can't read: make a JPG copy first (Mac: sips -s format jpeg "${name}" --out "${name.replace(/\.hei[cf]$/i, ".jpg")}")`);
    if (!KINDS.includes(ext)) return errors.push(`beat ${k + 1}: the photo ${name} must be a PNG, JPG or WEBP file`);
    if (!existsSync(file)) return errors.push(`beat ${k + 1}: the photo ${name} isn't there (looked for ${file})`);
    if (statSync(file).size > 25e6) return errors.push(`beat ${k + 1}: the photo ${name} is over 25 MB: save a smaller copy (about 2000 px across is plenty)`);
    photos[name] = `media/photo-${media.length}${ext}`;
    media.push({ from: file, to: photos[name] });
  });
  return { errors, data: { photos, media } };
}

// A narrator's figure: a built-in one by name (figures/<name>.json) or the member's own file next to the plan.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFigure } from "../../shared/parts.js";

const FIGURES = fileURLToPath(new URL("../../figures/", import.meta.url));

// { figure, errors }: the checked figure, or what's wrong in words
export function loadFigure(entry, planDir = ".") {
  const name = String(entry);
  const own = name.endsWith(".json"), file = own ? resolve(planDir, name) : join(FIGURES, `${name}.json`);
  if ((!own && !/^[\w-]+$/.test(name)) || !existsSync(file)) {
    const built = readdirSync(FIGURES).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    return { figure: null, errors: [own ? `the figure file ${name} isn't there (looked for ${file})`
      : `there's no built-in figure "${name}". Built in: ${built.join(", ")}; or give a figure file like "me.json"`] };
  }
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")); // a BOM from Windows Notepad
  } catch (e) {
    return { figure: null, errors: [`${name} isn't valid JSON (${e.message})`] };
  }
  return checkFigure(json, name);
}

// A style's HyperFrames project: its template, the shared browser code, the fonts, and the plan as window.PLAN.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function buildProject({ styleDir, sharedDir, fontsDir, outDir, data }) {
  rmSync(outDir, { recursive: true, force: true }); // our own scratch folder: no stale files from a last render
  mkdirSync(outDir, { recursive: true });
  cpSync(join(styleDir, "template"), outDir, { recursive: true });
  if (existsSync(sharedDir)) cpSync(sharedDir, join(outDir, "shared"), { recursive: true });
  cpSync(fontsDir, join(outDir, "fonts"), { recursive: true });
  const index = join(outDir, "index.html");
  writeFileSync(index, readFileSync(index, "utf8").replaceAll("{{DUR}}", data.dur.toFixed(3)));
  writeFileSync(join(outDir, "plan.js"), `window.PLAN = ${JSON.stringify(data)};\n`);
  return outDir;
}

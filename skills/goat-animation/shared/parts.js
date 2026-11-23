// The parts a paper figure is made from. A figure (figures/*.json, or the member's own figure.json made from their
// photo) picks one of each list and its colours; puppet.js draws them. No imports: the plan checker reads it in Node.
export const PARTS = {
  hair: ["curly-top", "curly-mop", "short", "side-part", "buzz", "bald", "long", "bob", "ponytail", "bun"],
  glasses: ["none", "clear", "dark", "round", "aviator"],
  face: ["none", "stubble", "mustache", "goatee", "beard"],
  top: ["crew", "hoodie", "shirt", "tee"],
  sleeves: ["full", "pushed", "short"],
};
// every field, with what it is when the figure leaves it out
export const FIGURE_DEFAULTS = {
  name: "", skin: "#E8B992", hair: "short", hairColor: "#2A1E18", glasses: "none", face: "none",
  top: "crew", topColor: "#1D1D20", sleeves: "full", pants: "#2E3D5C", shoes: "#F4F1EA", watch: false,
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const COLORS = ["skin", "hairColor", "topColor", "pants", "shoes"];

// A figure with its defaults filled in, and what's wrong with it (empty when it's good). `label` names it in messages.
export function checkFigure(fig, label = "the figure") {
  const errors = [];
  if (!fig || typeof fig !== "object" || Array.isArray(fig)) return { figure: null, errors: [`${label} must be a JSON object like {"hair": "short", ...}`] };
  for (const k of Object.keys(fig)) if (!(k in FIGURE_DEFAULTS)) errors.push(`${label}: "${k}" isn't a figure field. Fields: ${Object.keys(FIGURE_DEFAULTS).join(", ")}`);
  const f = { ...FIGURE_DEFAULTS, ...fig };
  for (const [k, list] of Object.entries(PARTS)) if (!list.includes(f[k])) errors.push(`${label}: "${k}" is "${f[k]}"; pick one of: ${list.join(", ")}`);
  for (const k of COLORS) if (!HEX.test(String(f[k]))) errors.push(`${label}: "${k}" must be a colour like "#2A1E18" (it is ${JSON.stringify(f[k])})`);
  if (typeof f.watch !== "boolean") errors.push(`${label}: "watch" is true or false`);
  if (typeof f.name !== "string" || [...f.name].length > 24) errors.push(`${label}: "name" is a short text, 24 characters at most`);
  if (f.top === "tee" && f.sleeves !== "short") f.sleeves = "short"; // a T-shirt only comes with short sleeves
  return { figure: errors.length ? null : f, errors };
}

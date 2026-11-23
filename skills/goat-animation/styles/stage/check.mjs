// Plan rules for Stage: who narrates, when the stage goes dark (and back), and who speaks from which word.
import { loadFigure } from "../../scripts/lib/figure.mjs";
import { findSay } from "../../scripts/lib/plan.mjs";

export default function check(beats, plan, { words, planDir, end }) {
  const errors = [], entries = plan.narrator === undefined ? [] : [plan.narrator].flat().map(String);
  if (!entries.length) errors.push('Stage needs "narrator": the user\'s figure file, like "figure.json" (step 3b)');
  if (entries.length > 2) errors.push('"narrator" is one figure, or a list of two: ["me.json", "friend.json"]');
  const narrators = entries.slice(0, 2).map((e) => {
    const r = loadFigure(e, planDir);
    errors.push(...r.errors);
    return r.figure;
  });
  // a moment in the plan: { "say": "words" } or { "at": seconds }, found from word `from` on
  let from = 0;
  const when = (item, label) => {
    if (typeof item?.at === "number") return item.at;
    const i = typeof item?.say === "string" ? findSay(words, item.say, from) : -1;
    if (i < 0) {
      errors.push(typeof item?.say === "string" ? `${label}: "${item.say}" isn't in the words` : `${label}: give it "say" (words from the captions) or "at" (seconds)`);
      return null;
    }
    from = i + 1;
    return words[i].start;
  };
  const turn = plan.turn === undefined ? null : when(plan.turn, '"turn"');
  const turnBack = plan.turnBack === undefined ? null : when(plan.turnBack, '"turnBack"');
  if (turnBack !== null && (turn === null || turnBack < turn + 1)) errors.push('"turnBack" needs a "turn" at least 1 s before it');
  if (turn !== null && turn > end - 1) errors.push('"turn" comes too late to see: put it on an earlier word');
  from = 0;
  const speakers = [];
  if (entries.length === 2 && plan.speakers === undefined) errors.push('two narrators need "speakers": who talks from which word, like [{ "at": 0, "who": "me.json" }]');
  if (plan.speakers !== undefined) {
    if (entries.length !== 2) errors.push('"speakers" is only for two narrators');
    else [plan.speakers].flat().forEach((s, k) => {
      const who = entries.indexOf(String(s?.who));
      if (who < 0) errors.push(`speaker ${k + 1}: "who" is one of the narrators: ${entries.map((e) => `"${e}"`).join(" or ")}`);
      const t = when(s, `speaker ${k + 1}`);
      if (who >= 0 && t !== null) speakers.push({ t, who });
    });
  }
  speakers.sort((a, b) => a.t - b.t);
  return { errors, data: { narrators: narrators.filter(Boolean), turn, turnBack, speakers } };
}

/**
 * Anti-telegraph rule — pure, dependency-free (Feature 1, SPEC §19).
 *
 * The AI prospect must open like a real call and create a SITUATION that
 * surfaces the drilled skill WITHOUT naming or telegraphing it. This is the
 * single source of truth for "does this text name the skill", used by the
 * drill-scenario adapter to self-filter its opener and asserted by the fixture
 * test (RUBRIC F1-2/F1-3). Deterministic so the gate is reproducible.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "that", "this", "into", "over",
  "under", "about", "from", "have", "what", "when", "where", "which", "their",
  "them", "target", "targets", "min", "minute", "minutes",
]);

/** Significant tokens of a skill name: alphabetic, length ≥4, not stopwords,
 * parentheticals dropped. e.g. "Pain quantified in $ or days" → [pain, quantified, days]. */
export function skillTokens(skillName) {
  const noParens = String(skillName ?? "").replace(/\([^)]*\)/g, " ");
  return noParens
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Prefix match (first 5 chars) so "quantified" ≈ "quantifying" ≈ "quantify". */
function sharesPrefix(a, b) {
  const n = Math.min(a.length, b.length, 5);
  return n >= 4 && a.slice(0, n) === b.slice(0, n);
}

/**
 * True if `text` names/telegraphs the skill: it contains the skill name as a
 * phrase, OR ≥2 of the skill's significant tokens, OR a rubric/metric meta-word.
 *
 * @param {string} text
 * @param {string} skillName
 */
export function mentionsSkill(text, skillName) {
  const hay = String(text ?? "").toLowerCase();
  if (!hay.trim()) return false;

  // Meta-words that reveal "this is a graded drill", never said by a real buyer.
  if (/\b(rubric|metric|score|scored|drill|skill|coaching|criteri)/.test(hay)) return true;

  const phrase = String(skillName ?? "").toLowerCase().replace(/\([^)]*\)/g, "").trim();
  if (phrase && hay.includes(phrase)) return true;

  const tokens = skillTokens(skillName);
  const words = hay.split(/[^a-z]+/).filter(Boolean);
  let hits = 0;
  for (const tok of tokens) {
    if (words.some((w) => sharesPrefix(w, tok))) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

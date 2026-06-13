/**
 * Fixture test for the CoachLoop scoring grader.
 *
 * Feeds a KNOWN seeded transcript + a golden scorer output through the grader
 * and asserts the product's invariants (SPEC.md §13 / RUBRIC.md). The second
 * half mutates the golden output into BAD scores and asserts the grader rejects
 * them — proving it fails loudly, which is the whole point of a gate.
 *
 * Runs with zero dependencies on Node 18+:  node --test test/scorer.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  validateEvaluation,
  validateRescore,
  bandFor,
  computeScore100,
  selectWeakest,
  BANDS,
} from "../lib/scoring/grade.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (p) => JSON.parse(readFileSync(join(here, p), "utf8"));

const transcript = load("fixtures/discovery-transcript.json");
const evaluation = load("fixtures/golden-evaluation.json");
const rescore = load("fixtures/golden-rescore.json");

// ── Happy path: the golden output must satisfy every invariant ──────────────

test("golden evaluation passes all grader invariants", () => {
  const { ok, errors } = validateEvaluation(evaluation, transcript);
  assert.equal(ok, true, `unexpected errors:\n  - ${errors.join("\n  - ")}`);
});

test("every score cites a timestamp that exists in the transcript", () => {
  const tsSet = new Set(transcript.segments.map((s) => s.ts));
  for (const item of evaluation.items) {
    assert.notEqual(item.cite_ts_seconds, null, `item ${item.rubric_item_id} has no timestamp`);
    assert.ok(
      tsSet.has(item.cite_ts_seconds),
      `item ${item.rubric_item_id} cites ${item.cite_ts_seconds}s, not in transcript`,
    );
  }
});

test("score band is a valid value and matches the computed score", () => {
  const score = computeScore100(evaluation.items);
  assert.equal(Math.round(score), evaluation.score_100);
  assert.ok(BANDS.includes(evaluation.band), `"${evaluation.band}" is not a valid band`);
  assert.equal(bandFor(score), evaluation.band);
});

test("weakest skill is the highest-leverage item and is jump-able (clickable)", () => {
  const weakest = selectWeakest(evaluation.items);
  assert.equal(weakest.rubric_item_id, evaluation.weakest_item_id);
  // "clickable" in the UI requires a timestamp to jump to
  assert.notEqual(weakest.cite_ts_seconds, null);
});

test("re-score is scoped to the drilled skill with a correct before/after delta", () => {
  const { ok, errors } = validateRescore(rescore, evaluation);
  assert.equal(ok, true, `unexpected errors:\n  - ${errors.join("\n  - ")}`);
  assert.ok(rescore.delta_points_100 > 0, "expected the drill to show a positive gain");
});

// ── Duplicate timestamps: a real quote in a SHADOWED segment must ground ────
// Two utterances can share a second (raw paste / Circleback MM:SS). A ts->text
// map is last-wins and would shadow the first segment, falsely rejecting a real
// citation as "hallucinated". The grader must check every segment at that ts.

const dupTsTranscript = {
  segments: [
    { ts: 12, speaker: "Rep", text: "So what's the cost of doing nothing here?" },
    { ts: 12, speaker: "Prospect", text: "Honestly about 40 hours a month of FTE time." },
  ],
};
const dupTsEval = {
  score_100: 60,
  band: "needs_work",
  weakest_item_id: 1,
  items: [
    { rubric_item_id: 1, weight: 100, score_1_5: 3, cite_ts_seconds: 12, cite_quote: "cost of doing nothing" },
  ],
};

test("grounds a real quote from the FIRST segment when two segments share a timestamp", () => {
  const { ok, errors } = validateEvaluation(dupTsEval, dupTsTranscript);
  assert.equal(ok, true, `unexpected errors:\n  - ${errors.join("\n  - ")}`);
});

test("still rejects a quote absent from every segment at a shared timestamp", () => {
  const bad = structuredClone(dupTsEval);
  bad.items[0].cite_quote = "a line nobody said at twelve seconds";
  const { ok, errors } = validateEvaluation(bad, dupTsTranscript);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /hallucinated|not found/i.test(e)), errors.join("; "));
});

// ── Fails loudly: each mutation must be REJECTED ────────────────────────────

test("rejects a score with a missing timestamp", () => {
  const bad = structuredClone(evaluation);
  bad.items[2].cite_ts_seconds = null;
  const { ok, errors } = validateEvaluation(bad, transcript);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /timestamp/i.test(e)), errors.join("; "));
});

test("rejects a citation pointing at a timestamp not in the transcript", () => {
  const bad = structuredClone(evaluation);
  bad.items[0].cite_ts_seconds = 9999;
  assert.equal(validateEvaluation(bad, transcript).ok, false);
});

test("rejects a hallucinated quote not present at the cited timestamp", () => {
  const bad = structuredClone(evaluation);
  bad.items[0].cite_quote = "this line was never said on the call";
  assert.equal(validateEvaluation(bad, transcript).ok, false);
});

test("rejects a band that does not match the score", () => {
  const bad = structuredClone(evaluation);
  bad.band = "strong";
  const { ok, errors } = validateEvaluation(bad, transcript);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /band/i.test(e)), errors.join("; "));
});

test("rejects a wrong weakest-skill flag", () => {
  const bad = structuredClone(evaluation);
  bad.weakest_item_id = 1; // agenda — not the highest leverage
  const { ok, errors } = validateEvaluation(bad, transcript);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /weakest/i.test(e)), errors.join("; "));
});

test("rejects a re-score whose delta math is wrong", () => {
  const bad = structuredClone(rescore);
  bad.delta_points_100 = 99;
  assert.equal(validateRescore(bad, evaluation).ok, false);
});

test("rejects a re-score whose before-score lies about the original", () => {
  const bad = structuredClone(rescore);
  bad.before_1_5 = 5; // original was 2
  assert.equal(validateRescore(bad, evaluation).ok, false);
});

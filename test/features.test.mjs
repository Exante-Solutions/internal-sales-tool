/**
 * Batch-2 feature gates (SPEC §18–§23 / RUBRIC Part II). Zero-dependency,
 * runnable with: node --test test/features.test.mjs
 *
 * Each assertion fails loudly when its feature is broken. Qualitative criteria
 * (F1-Q, F4-Q) are graded by the reviewer agent, not here. The pure libs tested
 * below are the SAME single sources of truth the app imports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { mentionsSkill } from "../lib/coaching/telegraph.mjs";
import { parseTranscript } from "../lib/ingest/parse.mjs";
import { createInMemoryStore } from "../lib/store/in-memory.mjs";
import { selectTeamGap } from "../lib/team/select.mjs";
import { buildRecommendations } from "../lib/team/action.mjs";
import { SEEDED_SESSION, authMode } from "../lib/auth/session.mjs";
import { TOUR_STEPS, TOUR_ROUTES } from "../lib/tour/steps.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const readData = (p) => readFileSync(join(here, "..", "src", "data", p), "utf8");
const loadData = (p) => JSON.parse(readData(p));

// ── F1. Contextualized drills — coach prep, no telegraphing ─────────────────

test("F1-1: the seeded coach briefing has the coaching-prep shape", () => {
  const b = loadData("artifacts/discovery-briefing.json");
  for (const key of ["skill", "situation", "the_move", "sample_line", "opener"]) {
    assert.ok(typeof b[key] === "string" && b[key].trim().length > 0, `briefing.${key} missing`);
  }
});

test("F1-2: the prospect opener does not telegraph the skill (real seed data)", () => {
  const scenario = loadData("artifacts/discovery-drill-scenario.json");
  const briefing = loadData("artifacts/discovery-briefing.json");
  assert.equal(
    mentionsSkill(scenario.opening_line, scenario.skill),
    false,
    `scenario opener telegraphs "${scenario.skill}": ${scenario.opening_line}`,
  );
  assert.equal(
    mentionsSkill(briefing.opener, briefing.skill),
    false,
    `briefing opener telegraphs the skill: ${briefing.opener}`,
  );
});

test("F1-3: the gate fails loudly — a telegraphing opener IS caught", () => {
  const skill = "Pain quantified in $ or days";
  assert.equal(mentionsSkill("Let's work on quantifying the pain in dollars and days.", skill), true);
  // meta-language a real buyer would never use
  assert.equal(mentionsSkill("This is the rubric item we're scoring you on.", skill), true);
});

// ── F2. Live call ingestion — seeded files + store ownership ─────────────────

test("F2-1: every seeded example parses to grounded segments (≥8, numeric ts)", () => {
  for (const file of ["acme-logistics-discovery.txt", "meridian-health-demo.txt"]) {
    const segs = parseTranscript(readData(join("examples", file)));
    assert.ok(segs.length >= 8, `${file} parsed to only ${segs.length} segments`);
    for (const s of segs) {
      assert.equal(typeof s.ts, "number", `${file}: non-numeric ts`);
      assert.ok(Number.isFinite(s.ts), `${file}: ts not finite`);
      assert.ok(s.speaker && s.speaker.length > 0, `${file}: missing speaker`);
      assert.ok(s.text && s.text.length > 0, `${file}: empty text`);
    }
  }
});

test("F2-2: the call store round-trips a saved call", () => {
  const store = createInMemoryStore();
  const call = { meta: { id: "c1", prospect: "Acme" }, evaluation: { score_100: 70 } };
  store.save("user-a", call);
  assert.deepEqual(store.get("user-a", "c1"), call);
  assert.equal(store.list("user-a").length, 1);
});

test("F2-3: the call store enforces per-user ownership (fails loudly)", () => {
  const store = createInMemoryStore();
  store.save("user-a", { meta: { id: "c1" } });
  assert.equal(store.get("user-b", "c1"), null, "user B must not see user A's call");
  assert.equal(store.list("user-b").length, 0, "user B's list must be empty");
});

// ── F3. Auth-ready Session + home menu ───────────────────────────────────────

test("F3-1: the seeded session is well-formed", () => {
  assert.ok(SEEDED_SESSION.userId && SEEDED_SESSION.userId.length > 0);
  assert.ok(SEEDED_SESSION.teamId && SEEDED_SESSION.teamId.length > 0);
  assert.equal(SEEDED_SESSION.isAuthenticated, false);
});

test("F3-2: auth falls back to seeded when AUTH0_* is unset (demo never breaks)", () => {
  assert.equal(authMode({}), "seeded");
  assert.equal(authMode({ AUTH0_DOMAIN: "x" }), "seeded"); // partial config still seeded
  assert.equal(authMode({ AUTH0_DOMAIN: "x", AUTH0_CLIENT_ID: "y" }), "auth0");
});

// ── F4. TeamView organized by the rubric ─────────────────────────────────────

const STATS_FIXTURE = [
  { itemId: 1, name: "Agenda set", avg: 4, weight: 5 }, // leverage (5-4)*5 = 5
  { itemId: 3, name: "Pain quantified", avg: 2, weight: 20 }, // leverage 3*20 = 60 ← max
  { itemId: 9, name: "Next step locked", avg: 3, weight: 10 }, // leverage 2*10 = 20
];

test("F4-1: team gap is the highest-leverage rubric item", () => {
  const gap = selectTeamGap(STATS_FIXTURE);
  assert.equal(gap.itemId, 3, "expected the max (5-avg)×weight item");
});

test("F4-2: the coaching action assigns the right skill, worst rep first", () => {
  const gap = selectTeamGap(STATS_FIXTURE);
  const perRep = [
    { repId: "r-ann", repName: "Ann", score: 4 },
    { repId: "r-bo", repName: "Bo", score: 1 },
    { repId: "r-cy", repName: "Cy", score: 3 },
  ];
  const recs = buildRecommendations(gap, perRep);
  assert.ok(recs.length > 0, "expected at least one recommendation");
  assert.equal(recs[0].repId, "r-bo", "worst scorer must be coached first");
  for (const r of recs) {
    assert.equal(r.itemId, gap.itemId, "every rec must target the team gap item");
    assert.ok(r.skill === gap.name, "every rec must name the gap skill");
    assert.ok(r.repName && r.repName.length > 0, "every rec must name a rep");
  }
});

// ── F5. Guided tour / first-run onboarding ───────────────────────────────────

test("F5-1: tour steps cover the loop in demo order", () => {
  const idx = (id) => TOUR_STEPS.findIndex((s) => s.id === id);
  const loop = ["score", "cite", "weakest", "drill", "rescore"];
  let prev = -1;
  for (const id of loop) {
    const i = idx(id);
    assert.ok(i > -1, `tour missing the "${id}" step`);
    assert.ok(i > prev, `step "${id}" is out of demo order`);
    prev = i;
  }
  assert.ok(idx("team") > -1, "tour must include the team assign-a-drill step");
  assert.equal(TOUR_STEPS[0].path, "/", "the tour must start on the home route");
});

test("F5-2: every tour step is well-formed and routes to a real page", () => {
  assert.ok(TOUR_STEPS.length >= 6, "expected at least the 6 loop+team steps");
  const seen = new Set();
  for (const s of TOUR_STEPS) {
    for (const key of ["id", "title", "body", "target"]) {
      assert.ok(typeof s[key] === "string" && s[key].trim().length > 0, `step ${s.id}: ${key} missing`);
    }
    assert.ok(!seen.has(s.id), `duplicate step id ${s.id}`);
    seen.add(s.id);
    assert.ok(TOUR_ROUTES.includes(s.path), `step ${s.id} routes to unknown path ${s.path}`);
  }
});

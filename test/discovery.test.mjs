/**
 * Discovery Workspace acceptance gates (SPEC + RUBRIC §A–§M).
 *
 * TDD RED: these encode the MUST criteria as contracts on the pure, framework-free
 * `lib/` modules the domain/application layers will import (same single-source-of-
 * truth pattern as lib/scoring/grade.mjs, lib/ingest/parse.mjs, lib/team/select.mjs).
 * Most of those modules do not exist yet, so these tests FAIL until the build
 * implements them — that failure IS the spec made executable.
 *
 * Each test dynamic-imports its module so a not-yet-built module fails only its own
 * criterion (granular red → green), not the whole file.
 *
 *   node --test test/discovery.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const load = (rel) => import(new URL(`../${rel}`, import.meta.url));
const fixture = (p) => JSON.parse(readFileSync(join(here, "fixtures", p), "utf8"));

// ── C. Identity resolution & dedup ──────────────────────────────────────────

test("C5: normalizeEmail folds case + whitespace deterministically", async () => {
  const { normalizeEmail } = await load("lib/identity/email.mjs");
  assert.equal(normalizeEmail("  John.Doe@Acme.COM "), "john.doe@acme.com");
  assert.equal(normalizeEmail("a@b.com"), normalizeEmail("A@B.com"));
});

test("C1: a known email resolves to the existing person, no new person", async () => {
  const { resolveIdentity } = await load("lib/identity/resolve.mjs");
  const people = [
    { id: "p1", emails: ["john@acme.com"] },
    { id: "p2", emails: ["jane@globex.com"] },
  ];
  const r = resolveIdentity("john@acme.com", { people });
  assert.equal(r.status, "known");
  assert.equal(r.personId, "p1");
  assert.equal(r.suggestions?.length ?? 0, 0);
});

test("C2: an unknown email is provisional + suggests, never silent-merges", async () => {
  const { resolveIdentity } = await load("lib/identity/resolve.mjs");
  const people = [{ id: "p1", displayName: "John Doe", emails: ["john@acme.com"] }];
  const r = resolveIdentity("john.personal@gmail.com", {
    people,
    hintName: "John Doe",
  });
  assert.equal(r.status, "provisional");
  assert.notEqual(r.personId, "p1"); // must NOT attach to an existing person
  assert.ok(Array.isArray(r.suggestions) && r.suggestions.length >= 1, "expected a merge suggestion");
  assert.equal(r.suggestions[0].personId, "p1");
});

test("C3: merging unifies identities + history under the survivor", async () => {
  const { mergePeople } = await load("lib/identity/merge.mjs");
  const survivor = { id: "p1", emails: ["john@acme.com"], memberships: [{ companyId: "acme" }] };
  const other = { id: "p9", emails: ["john@gmail.com"], memberships: [{ companyId: "beta" }] };
  const merged = mergePeople(survivor, other);
  assert.deepEqual(new Set(merged.emails), new Set(["john@acme.com", "john@gmail.com"]));
  assert.equal(merged.memberships.length, 2);
  assert.equal(merged.mergedAwayIds?.includes("p9") || other.merged_into_id === "p1" || merged.absorbed?.includes("p9"), true);
});

test("C4: 'when have I talked to X' spans all of a person's emails", async () => {
  const { personMatchesEmail } = await load("lib/identity/resolve.mjs");
  const person = { id: "p1", emails: ["john@acme.com", "john@gmail.com"] };
  assert.equal(personMatchesEmail(person, "john@gmail.com"), true);
  assert.equal(personMatchesEmail(person, "JOHN@ACME.COM"), true); // normalized
  assert.equal(personMatchesEmail(person, "someone@else.com"), false);
});

test("C(golden): resolveIdentity over a scenario matches the committed fixture", async () => {
  const { resolveIdentity } = await load("lib/identity/resolve.mjs");
  const golden = fixture("identity-resolution.golden.json");
  const actual = golden.cases.map((c) => {
    const r = resolveIdentity(c.email, { people: golden.people, hintName: c.hintName });
    return { email: c.email, status: r.status, personId: r.personId, suggested: (r.suggestions ?? []).map((s) => s.personId) };
  });
  assert.deepEqual(actual, golden.expected);
});

// ── D. Person-centric model: memberships + affiliation snapshot ──────────────

test("D2: membership range invariant — ended_on must be ≥ started_on", async () => {
  const { validateMembership } = await load("lib/company/membership.mjs");
  assert.equal(validateMembership({ startedOn: "2024-01-01", endedOn: "2024-06-01" }), true);
  assert.equal(validateMembership({ startedOn: "2024-06-01", endedOn: "2024-01-01" }), false);
  assert.equal(validateMembership({ startedOn: "2024-01-01", endedOn: null, isCurrent: true }), true);
});

test("D3: participant snapshot freezes the company in effect at conversation time", async () => {
  const { participantSnapshot } = await load("lib/conversation/snapshot.mjs");
  const person = {
    id: "p1",
    emails: ["john@acme.com", "john@beta.com"],
    memberships: [
      { companyId: "acme", startedOn: "2023-01-01", endedOn: "2024-12-31" },
      { companyId: "beta", startedOn: "2025-01-01", endedOn: null, isCurrent: true },
    ],
  };
  const snap = participantSnapshot(person, "2024-03-01T00:00:00Z");
  assert.equal(snap.companyAtTime, "acme"); // the employer THEN, not now
});

test("D4: company filter uses the snapshot, so a pre-move call stays under the old company", async () => {
  const { filterConversationsByCompany } = await load("lib/conversation/snapshot.mjs");
  const conversations = [
    { id: "c1", participants: [{ personId: "p1", companyAtTime: "acme" }] },
    { id: "c2", participants: [{ personId: "p1", companyAtTime: "beta" }] },
  ];
  assert.deepEqual(filterConversationsByCompany(conversations, "acme").map((c) => c.id), ["c1"]);
  assert.deepEqual(filterConversationsByCompany(conversations, "beta").map((c) => c.id), ["c2"]);
});

test("D5: overriding company-at-time touches only that conversation", async () => {
  const { overrideCompanyAtTime } = await load("lib/conversation/snapshot.mjs");
  const participant = { personId: "p1", companyAtTime: "acme" };
  const fixed = overrideCompanyAtTime(participant, "acme-consulting");
  assert.equal(fixed.companyAtTime, "acme-consulting");
  assert.equal(participant.companyAtTime, "acme"); // original untouched (pure)
});

// ── E. Initiatives & prospect list ──────────────────────────────────────────

test("E1/E2: conversation↔initiative is many-to-many; unlink one leaves others", async () => {
  const { linkInitiative, unlinkInitiative, initiativesFor } = await load("lib/conversation/links.mjs");
  let links = [];
  links = linkInitiative(links, "c1", "i1");
  links = linkInitiative(links, "c1", "i2");
  assert.deepEqual(new Set(initiativesFor(links, "c1")), new Set(["i1", "i2"]));
  links = unlinkInitiative(links, "c1", "i1");
  assert.deepEqual(initiativesFor(links, "c1"), ["i2"]); // i2 intact
});

test("E4: target outreach status is from the allowed set and advanceable", async () => {
  const { TARGET_STATUSES, advanceTarget } = await load("lib/initiative/people.mjs");
  assert.deepEqual(TARGET_STATUSES, ["to_contact", "contacted", "responded", "engaged", "passed"]);
  const t = { personId: "p1", status: "to_contact" };
  assert.equal(advanceTarget(t, "contacted").status, "contacted");
  assert.throws(() => advanceTarget(t, "bogus"));
});

test("E5: people view = targets ∪ engaged, each correctly flagged", async () => {
  const { peopleView } = await load("lib/initiative/people.mjs");
  const view = peopleView({
    targets: [{ personId: "pA" }, { personId: "pC" }], // pA target-only, pC both
    engaged: [{ personId: "pB" }, { personId: "pC" }], // pB engaged-only, pC both
  });
  const by = Object.fromEntries(view.map((v) => [v.personId, v]));
  assert.deepEqual([by.pA.targeted, by.pA.engaged], [true, false]);
  assert.deepEqual([by.pB.targeted, by.pB.engaged], [false, true]);
  assert.deepEqual([by.pC.targeted, by.pC.engaged], [true, true]);
});

test("E6: initiative type + status enums reject bad values", async () => {
  const { INITIATIVE_TYPES, INITIATIVE_STATUSES } = await load("lib/initiative/people.mjs");
  assert.deepEqual(INITIATIVE_TYPES, ["market", "use_case", "persona", "workflow", "org"]);
  assert.deepEqual(INITIATIVE_STATUSES, ["active", "paused", "done"]);
});

// ── F. Ingestion & idempotency ──────────────────────────────────────────────

test("F3: re-ingesting the same (provider, externalId) creates no duplicate", async () => {
  const { upsertConversation, conversationKey } = await load("lib/ingest/idempotency.mjs");
  const incoming = { provider: "circleback", externalId: "abc", title: "Disco" };
  let { conversations, created } = upsertConversation([], incoming);
  assert.equal(created, true);
  assert.equal(conversations.length, 1);
  ({ conversations, created } = upsertConversation(conversations, incoming));
  assert.equal(created, false); // upsert, not insert
  assert.equal(conversations.length, 1);
  assert.equal(conversationKey("circleback", "abc"), conversations[0].key);
});

test("F4: calendar-link match associates; no match → null (→ unassigned inbox)", async () => {
  const { associateInitiative } = await load("lib/calendar/associate.mjs");
  const links = [{ linkId: "lnk-acme", initiativeId: "i1" }];
  assert.equal(associateInitiative({ linkId: "lnk-acme" }, links), "i1");
  assert.equal(associateInitiative({ linkId: "lnk-unknown" }, links), null);
  assert.equal(associateInitiative({}, links), null);
});

// ── I. Profiles: append-only timeline + derived rollup ───────────────────────

test("I1: appendEntry is append-only and pure (does not mutate input)", async () => {
  const { appendEntry } = await load("lib/profile/timeline.mjs");
  const t0 = [{ kind: "note", id: "n1" }];
  const t1 = appendEntry(t0, { kind: "email", id: "e1" });
  assert.equal(t0.length, 1); // original untouched
  assert.equal(t1.length, 2);
  assert.equal(t1[1].id, "e1");
});

test("I2: rollup is derived — records the entry count it summarized", async () => {
  const { summarySource } = await load("lib/profile/timeline.mjs");
  const timeline = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(summarySource(timeline).sourceEntryCount, 3);
});

// ── J. Gmail sync dedupe (behavioral, fake/offline) ──────────────────────────

test("J2/J3: dedupe merges the same thread across mailboxes by Message-ID", async () => {
  const { dedupeMessages } = await load("lib/email/dedupe.mjs");
  const fromAlice = [{ rfcMessageId: "<m1>", mailbox: "alice" }, { rfcMessageId: "<m2>", mailbox: "alice" }];
  const fromBob = [{ rfcMessageId: "<m1>", mailbox: "bob" }]; // same thread, other mailbox
  const merged = dedupeMessages([...fromAlice, ...fromBob]);
  assert.equal(merged.length, 2); // <m1> collapses to one
  assert.deepEqual(new Set(merged.map((m) => m.rfcMessageId)), new Set(["<m1>", "<m2>"]));
});

// ── S2. People CSV bulk import parser (pure, offline) — SPEC §18.5 ────────────

test("S2: parsePeopleCsv parses rows (name + emails + optional company)", async () => {
  const { parsePeopleCsv } = await load("lib/people/csv.mjs");
  const rows = parsePeopleCsv(
    "displayName,email,company\n" +
      "Sam Reyes,sam@acme.com,Acme\n" +
      "Dana Okafor,dana@acme.com,Acme\n",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].displayName, "Sam Reyes");
  assert.deepEqual(rows[0].emails, ["sam@acme.com"]);
  assert.equal(rows[0].company, "Acme");
});

test("S2: parsePeopleCsv tolerates header order/case + skips blank lines", async () => {
  const { parsePeopleCsv } = await load("lib/people/csv.mjs");
  const rows = parsePeopleCsv(
    "Company , EMAIL , Name\n" +
      "Globex, lee@globex.com , Lee Zhang\n" +
      "\n" + // blank line skipped
      "Acme,dana@acme.com,Dana Okafor\n",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].displayName, "Lee Zhang");
  assert.deepEqual(rows[0].emails, ["lee@globex.com"]);
  assert.equal(rows[0].company, "Globex");
  assert.equal(rows[1].displayName, "Dana Okafor");
});

test("S2: parsePeopleCsv handles multiple emails + quoted fields", async () => {
  const { parsePeopleCsv } = await load("lib/people/csv.mjs");
  const rows = parsePeopleCsv(
    'name,emails,company\n' +
      '"Reyes, Sam","sam@acme.com; sam@personal.com","Acme, Inc"\n',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayName, "Reyes, Sam");
  assert.deepEqual(rows[0].emails, ["sam@acme.com", "sam@personal.com"]);
  assert.equal(rows[0].company, "Acme, Inc");
});

test("S2: parsePeopleCsv skips rows with neither name nor email; derives name from email", async () => {
  const { parsePeopleCsv } = await load("lib/people/csv.mjs");
  const rows = parsePeopleCsv("name,email\n,,\nemail-only,\n,solo@x.com\n");
  // row1 (",,"): empty → skipped. row2 "email-only,": name only. row3 ",solo@x.com": email only → name derived.
  assert.equal(rows.length, 2);
  assert.equal(rows[0].displayName, "email-only");
  assert.equal(rows[1].displayName, "solo");
  assert.deepEqual(rows[1].emails, ["solo@x.com"]);
});

/**
 * BUG_FIX.md acceptance — pure-logic + memory-repo assertions (BF1, BF2, BF6, BF7).
 *
 * These encode the machine-confirmable checks from BUG_FIX.md §Rubric that live
 * on the pure libs and the in-memory repositories (offline, deterministic):
 *   - BF1 connectionState suffix-matching (lib/settings/connection-state.mjs)
 *   - BF2 participant snapshot picks current-membership company (lib/conversation/snapshot.mjs)
 *   - BF6 InitiativeRepository.delete cascade preserves the conversation (memory repo)
 *   - BF7 peopleView unions targeted-only people with 0 engaged (lib/initiative/people.mjs)
 *
 * The route/structural checks (markers, route existence, response shape) are the
 * Verify agent's verify.sh greps; this file owns the logic the routes call.
 *
 *   node --import tsx --test test/bugfix.test.mjs
 *
 * The memory-repo (TS) import needs the tsx loader for the @/ alias + types; the
 * package.json "test" script runs node --import tsx so both kinds run together.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const load = (rel) => import(new URL(`../${rel}`, import.meta.url));

// ── BF1: connectionState resolves gmail/calendar by scope SUFFIX ─────────────

test("BF1: gmail-only scopes → gmailConnected, calendar false", async () => {
  const { connectionState } = await load("lib/settings/connection-state.mjs");
  const s = connectionState([
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.readonly",
  ]);
  assert.equal(s.gmailConnected, true);
  assert.equal(s.calendarConnected, false);
});

test("BF1: calendar-only scopes → calendarConnected, gmail false", async () => {
  const { connectionState } = await load("lib/settings/connection-state.mjs");
  const s = connectionState([
    "https://www.googleapis.com/auth/calendar.readonly",
  ]);
  assert.equal(s.calendarConnected, true);
  assert.equal(s.gmailConnected, false);
});

test("BF1: both grants present (full-URL + space-joined string) → both true", async () => {
  const { connectionState } = await load("lib/settings/connection-state.mjs");
  const s = connectionState(
    "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
  );
  assert.equal(s.gmailConnected, true);
  assert.equal(s.calendarConnected, true);
});

test("BF1: no scopes → both false", async () => {
  const { connectionState } = await load("lib/settings/connection-state.mjs");
  assert.deepEqual(connectionState([]), {
    gmailConnected: false,
    calendarConnected: false,
  });
  assert.deepEqual(connectionState(null), {
    gmailConnected: false,
    calendarConnected: false,
  });
});

// ── BF2: participant snapshot uses the CURRENT-at-occurredAt membership ──────

test("BF2: participantSnapshot picks the company current at occurredAt", async () => {
  const { participantSnapshot } = await load("lib/conversation/snapshot.mjs");
  const person = {
    emails: ["dana@globex.com"],
    memberships: [
      { companyId: "acme", startedOn: "2020-01-01", endedOn: "2022-12-31" },
      { companyId: "globex", startedOn: "2023-01-01", endedOn: null },
    ],
  };
  // A 2024 conversation must snapshot the CURRENT (globex) membership, not acme.
  const snap = participantSnapshot(person, "2024-06-01T10:00:00.000Z");
  assert.equal(snap.companyAtTime, "globex");
  assert.equal(snap.emailUsed, "dana@globex.com");

  // A pre-move (2021) conversation freezes the old (acme) employer.
  const past = participantSnapshot(person, "2021-06-01T10:00:00.000Z");
  assert.equal(past.companyAtTime, "acme");
});

// ── BF6: InitiativeRepository.delete cascades, conversation PRESERVED ────────

test("BF6: memory delete removes initiative + targets + links, keeps conversation", async () => {
  const { resetMemoryDb, MemoryInitiativeRepository, MemoryConversationRepository } =
    await load("src/infrastructure/db/memory-repositories.ts");
  resetMemoryDb();

  const initiatives = new MemoryInitiativeRepository();
  const conversations = new MemoryConversationRepository();
  const teamId = "team-1";

  await initiatives.save({
    id: "init-1",
    teamId,
    name: "ICP discovery",
    type: "market",
    goalMd: "",
    hypothesisMd: "",
    status: "active",
    createdBy: "u1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  await initiatives.addTarget({
    id: "tg-1",
    initiativeId: "init-1",
    personId: "p1",
    status: "to_contact",
    addedBy: "u1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  await conversations.save({
    id: "conv-1",
    teamId,
    source: "pasted",
    title: "intro call",
    reasonMd: "",
    outcomeMd: "",
    occurredAt: "2024-02-01T00:00:00.000Z",
    createdBy: "u1",
    createdAt: "2024-02-01T00:00:00.000Z",
    participants: [],
    segments: [],
    initiativeIds: ["init-1"],
  });

  // preconditions
  assert.equal((await initiatives.listTargets("init-1")).length, 1);
  assert.deepEqual(
    (await conversations.get(teamId, "conv-1")).initiativeIds,
    ["init-1"],
  );

  await initiatives.delete(teamId, "init-1");

  // initiative gone, targets gone, link gone
  assert.equal(await initiatives.get(teamId, "init-1"), null);
  assert.equal((await initiatives.listTargets("init-1")).length, 0);

  // conversation PRESERVED, just unlinked from the deleted initiative
  const conv = await conversations.get(teamId, "conv-1");
  assert.ok(conv, "conversation must survive a hard initiative delete");
  assert.deepEqual(conv.initiativeIds, []);
});

test("BF6: delete is team-scoped (wrong team is a no-op)", async () => {
  const { resetMemoryDb, MemoryInitiativeRepository } = await load(
    "src/infrastructure/db/memory-repositories.ts",
  );
  resetMemoryDb();
  const initiatives = new MemoryInitiativeRepository();
  await initiatives.save({
    id: "init-1",
    teamId: "team-1",
    name: "x",
    type: "market",
    goalMd: "",
    hypothesisMd: "",
    status: "active",
    createdBy: "u1",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  await initiatives.delete("team-OTHER", "init-1");
  assert.ok(await initiatives.get("team-1", "init-1"), "other-team delete is a no-op");
});

// ── BF7: peopleView unions targeted-only people even with 0 engaged ─────────

test("BF7: a targeted person with 0 conversations appears in the union", async () => {
  const { peopleView } = await load("lib/initiative/people.mjs");
  const view = peopleView({
    targets: [{ personId: "p1" }, { personId: "p2" }],
    engaged: [],
  });
  assert.equal(view.length, 2);
  const p1 = view.find((v) => v.personId === "p1");
  assert.ok(p1, "targeted-only person must surface in targets ∪ engaged");
  assert.equal(p1.targeted, true);
  assert.equal(p1.engaged, false);
});

// ── BF11: navActive — query-aware Calls vs Unassigned-inbox highlight ────────

test("BF11: inbox href active on /conversations?inbox=1, Calls inactive", async () => {
  const { navActive } = await load("lib/nav/active.mjs");
  // On the inbox view: the inbox link lights up, Calls does not.
  assert.equal(
    navActive("/conversations", "?inbox=1", "/conversations?inbox=1"),
    true,
  );
  assert.equal(navActive("/conversations", "?inbox=1", "/conversations"), false);
});

test("BF11: Calls href active on bare /conversations, inbox inactive", async () => {
  const { navActive } = await load("lib/nav/active.mjs");
  assert.equal(navActive("/conversations", "", "/conversations"), true);
  assert.equal(
    navActive("/conversations", "", "/conversations?inbox=1"),
    false,
  );
});

// ── BF12: unassignedOnly excludes initiative-linked conversations ────────────

test("BF12: list({unassignedOnly:true}) returns only the unlinked conversation", async () => {
  const { resetMemoryDb, MemoryConversationRepository } = await load(
    "src/infrastructure/db/memory-repositories.ts",
  );
  resetMemoryDb();

  const conversations = new MemoryConversationRepository();
  const teamId = "team-1";

  // One conversation assigned to an initiative …
  await conversations.save({
    id: "conv-assigned",
    teamId,
    source: "pasted",
    title: "assigned call",
    reasonMd: "",
    outcomeMd: "",
    occurredAt: "2024-02-01T00:00:00.000Z",
    createdBy: "u1",
    createdAt: "2024-02-01T00:00:00.000Z",
    participants: [],
    segments: [],
    initiativeIds: ["init-1"],
  });
  // … and one left in the unassigned inbox.
  await conversations.save({
    id: "conv-unassigned",
    teamId,
    source: "pasted",
    title: "unassigned call",
    reasonMd: "",
    outcomeMd: "",
    occurredAt: "2024-02-02T00:00:00.000Z",
    createdBy: "u1",
    createdAt: "2024-02-02T00:00:00.000Z",
    participants: [],
    segments: [],
    initiativeIds: [],
  });

  const inbox = await conversations.list(teamId, { unassignedOnly: true });
  assert.deepEqual(
    inbox.map((c) => c.id),
    ["conv-unassigned"],
    "the inbox must exclude initiative-linked conversations",
  );
});

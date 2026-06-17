/**
 * /api/people/import (SPEC §10, §18.5). Bulk-add people from a CSV upload.
 *
 *   POST { csv: string }  → parse rows via the pure `lib/people/csv.mjs`,
 *     then for each row run identity resolution by email to DEDUPE: an existing
 *     owner of any email is *updated* (new emails attached), an unseen email
 *     *creates* a person, a row with no usable identity is *skipped*. Reports
 *     per-row outcome + created/updated/skipped counts.
 *
 * Thin controller: Zod at the edge, csv parsing in the shared pure lib, dedupe
 * via the PersonRepository (findByEmail = identity resolution, §4.3).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";
import { makeNormalizedEmail, InvalidEmailError } from "@/domain/person";
import type { Person, EmailIdentity } from "@/domain/person";
// Pure parser shared with the unit tests (test/discovery.test.mjs S2 block).
import { parsePeopleCsv } from "../../../../../lib/people/csv.mjs";

export const runtime = "nodejs";

const Body = z.object({ csv: z.string().min(1) });

type RowOutcome = "created" | "updated" | "skipped";
interface RowReport {
  displayName: string;
  emails: string[];
  outcome: RowOutcome;
  personId?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }

  const session = await buildSession().current();
  const svc = getServices();
  const rows = parsePeopleCsv(parsed.data.csv) as {
    displayName: string;
    emails: string[];
    company?: string;
  }[];

  const reports: RowReport[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // Normalize the row's emails; drop any that fail validation.
    const normalized: string[] = [];
    for (const raw of row.emails) {
      try {
        normalized.push(makeNormalizedEmail(raw) as string);
      } catch (err) {
        if (!(err instanceof InvalidEmailError)) throw err;
      }
    }

    if (normalized.length === 0) {
      skipped++;
      reports.push({
        displayName: row.displayName,
        emails: row.emails,
        outcome: "skipped",
        reason: "no valid email",
      });
      continue;
    }

    // Identity resolution / dedupe (§4.3): does any of these emails already
    // belong to a person on this team?
    let existing: Person | null = null;
    for (const n of normalized) {
      existing = await svc.people.findByEmail(session.teamId, n);
      if (existing) break;
    }

    if (existing) {
      // UPDATE: attach any new emails this row carries to the survivor.
      const known = new Set(existing.emails.map((e) => e.emailNormalized as string));
      for (const n of normalized) {
        if (known.has(n)) continue;
        const identity: EmailIdentity = {
          id: svc.ids.next(),
          personId: existing.id,
          emailNormalized: makeNormalizedEmail(n),
          label: "work",
          verified: false,
          source: "manual",
        };
        await svc.people.addEmail(existing.id, identity);
        known.add(n);
      }
      updated++;
      reports.push({
        displayName: row.displayName,
        emails: normalized,
        outcome: "updated",
        personId: existing.id,
      });
      continue;
    }

    // CREATE: a new person keyed on the row's first valid email.
    const personId = svc.ids.next();
    const emails: EmailIdentity[] = normalized.map((n) => ({
      id: svc.ids.next(),
      personId,
      emailNormalized: makeNormalizedEmail(n),
      label: "work",
      verified: false,
      source: "manual",
    }));
    const person: Person = {
      id: personId,
      teamId: session.teamId,
      primaryDisplayName: row.displayName,
      emails,
      memberships: [],
      createdBy: session.userId,
      createdAt: svc.clock.nowIso(),
      mergedIntoId: null,
    };
    await svc.people.save(person);
    created++;
    reports.push({
      displayName: row.displayName,
      emails: normalized,
      outcome: "created",
      personId,
    });
  }

  return NextResponse.json(
    { summary: { created, updated, skipped, total: rows.length }, rows: reports },
    { status: 201 },
  );
}

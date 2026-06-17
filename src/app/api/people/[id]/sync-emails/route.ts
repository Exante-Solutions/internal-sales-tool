/**
 * POST /api/people/[id]/sync-emails (SPEC §6.4, §10). On-demand only: pull the
 * person's email threads across ALL connected team mailboxes, dedupe shared
 * threads by RFC Message-ID, and persist them permanently as EmailMessages +
 * timeline entries (cross-mailbox, RUBRIC J3/J6). The vendor mail payload dies
 * at the GmailGateway adapter.
 *
 * The set of connected team mailboxes is sourced from `google_connection` via
 * the GoogleConnectionRepository (every team member's secret_ref): SyncContactEmails
 * resolves them itself when no `mailboxes` arg is passed. Offline the
 * FakeGmailAdapter + FakeSecretStore make this run with no Google/AWS.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const person = await svc.people.get(session.teamId, id);
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    // Mailboxes omitted → SyncContactEmails enumerates every connected team
    // mailbox from google_connection.listForTeam and fans the pull across them.
    const result = await svc.syncContactEmails.sync(session, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "sync failed" }, { status: 500 });
  }
}

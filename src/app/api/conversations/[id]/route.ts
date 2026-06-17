/**
 * /api/conversations/[id] (SPEC §10).
 *   GET   → detail: the conversation (transcript, participants, initiative
 *           links) + its analysis (discovery fields + recorder summary +
 *           on-demand playbook eval if run) + follow-ups.
 *   PATCH → edit the conversation's editable fields (title/reason/outcome) and
 *           optionally (re)run discovery analysis with `analyze: true`.
 *
 * Thin controller: Zod at the edge, call the composition-root use case, return
 * JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServices, buildSession } from "@/infrastructure/composition";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await buildSession().current();
  const svc = getServices();
  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Include archived follow-ups so the UI can render each one's state
  // (open / done / archived) per SPEC §18.6 (T3). `initiatives` powers the
  // assign/remove control (§18.7); `conversation.initiativeIds` is the current
  // link set.
  const [analysis, followUps, initiatives] = await Promise.all([
    svc.conversations.getAnalysis(id),
    svc.followUps.listForConversation(id, { includeArchived: true }),
    svc.initiatives.list(session.teamId),
  ]);

  // BUG_FIX B3: return the exact shape the conversation-detail component reads
  // — top-level participants (joined to person name + company name),
  // recorderSummaryMd, recorderActionItems, flattened discoveryFields,
  // followUps, segments, initiatives, coachingEvaluation. The nested analysis
  // row is mapped here, at the boundary.
  const participants = await Promise.all(
    conversation.participants.map(async (p) => {
      const person = await svc.people.get(session.teamId, p.personId);
      let companyName: string | null = null;
      if (p.companyAtTime) {
        const company = await svc.companies.get(session.teamId, p.companyAtTime);
        companyName = company?.name ?? null;
      }
      return {
        personId: p.personId,
        personName: person?.primaryDisplayName ?? null,
        emailUsed: p.emailUsed,
        companyAtTime: p.companyAtTime ?? null,
        companyName,
        roleAtTime: p.roleAtTime ?? null,
      };
    }),
  );

  const discoveryFields = {
    summary: analysis?.summaryMd,
    whatWeLearned: (analysis?.whatWeLearned ?? []).map((f) => f.text),
    signals: (analysis?.signals ?? []).map((s) => s.text),
    nextSteps: analysis?.nextSteps ?? [],
    reasonMd: analysis?.reasonMd,
    outcomeMd: analysis?.outcomeMd,
  };

  return NextResponse.json({
    conversation,
    participants,
    recorderSummaryMd: analysis?.recorderSummaryMd,
    recorderActionItems: analysis?.recorderActionItems ?? [],
    discoveryFields,
    followUps,
    segments: conversation.segments,
    initiatives,
    coachingEvaluation: analysis?.coachingEvaluation ?? null,
  });
}

const Patch = z.object({
  title: z.string().min(1).optional(),
  reasonMd: z.string().optional(),
  outcomeMd: z.string().optional(),
  /** Run (or re-run) the discovery analysis pass over the available text. */
  analyze: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = Patch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const d = parsed.data;
  const session = await buildSession().current();
  const svc = getServices();

  const conversation = await svc.conversations.get(session.teamId, id);
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (d.title !== undefined || d.reasonMd !== undefined || d.outcomeMd !== undefined) {
    const updated = {
      ...conversation,
      title: d.title ?? conversation.title,
      reasonMd: d.reasonMd ?? conversation.reasonMd,
      outcomeMd: d.outcomeMd ?? conversation.outcomeMd,
    };
    await svc.conversations.save(updated);
  }

  // Field edits are already persisted above. If an analyze pass is requested and
  // fails, do NOT 500 — that would report failure even though the field edits did
  // land (C4.5). Surface the analyze failure as a non-fatal `analyzeError` and
  // still return 200 with the saved conversation.
  let analysis = null;
  let analyzeError: string | null = null;
  if (d.analyze) {
    try {
      const result = await svc.analyzeConversation.analyze(session, id);
      analysis = result.analysis;
    } catch (err) {
      analyzeError = err instanceof Error ? err.message : "analyze failed";
    }
  }

  const fresh = await svc.conversations.get(session.teamId, id);
  return NextResponse.json({ conversation: fresh, analysis, analyzeError });
}

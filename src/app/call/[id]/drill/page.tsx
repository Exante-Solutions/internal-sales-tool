import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DRILL_SCENARIOS } from "@/data/seed";
import { resolveCall } from "@/lib/calls";
import { seededCoachService } from "@/infrastructure/composition";
import { DrillClient } from "@/components/drill-client";

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skillId?: string }>;
}) {
  const { id } = await params;
  const { skillId: skillIdRaw } = await searchParams;
  // A manager-assigned drill (team view) targets a SPECIFIC skill via ?skillId;
  // otherwise the rep's own highest-leverage gap.
  const skillId = skillIdRaw ? Number(skillIdRaw) : undefined;
  const targetItemId = skillId != null && Number.isInteger(skillId) ? skillId : undefined;

  const resolved = await resolveCall(id);
  if (!resolved) notFound();
  const { evaluation, transcript, meta } = resolved;

  const moment = seededCoachService().fumbledMoment(evaluation, transcript, targetItemId);
  // Only reuse the seeded scenario when it matches the skill being drilled.
  const seeded = DRILL_SCENARIOS[id];
  const scenario = seeded && seeded.rubric_item_id === moment.rubric_item_id ? seeded : undefined;
  const openingLine = scenario?.opening_line ?? moment.prospect_line;
  const recovery = scenario?.recovery_condition ?? moment.anchorHigh;
  const prospectSystemPrompt =
    scenario?.prospect_system_prompt ??
    `You are ${transcript.contact}, ${transcript.contactRole} at ${transcript.prospect}. Re-stage the fumbled moment for the skill "${moment.skill}". Stay in character; concede when the rep reaches: ${moment.anchorHigh}.`;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/call/${id}`} className="flex items-center gap-1 text-sm text-neutral-400">
        <ChevronLeft className="h-4 w-4" /> Back to call
      </Link>
      <div>
        <h1 className="text-xl font-bold">Coaching session</h1>
        <p className="text-xs text-neutral-500">
          A quick prep with your coach, then a live roleplay with {meta.prospect}. Recover to raise your score.
        </p>
      </div>
      <DrillClient
        callId={id}
        skillId={moment.rubric_item_id}
        skill={moment.skill}
        before={moment.before_1_5}
        prospectSystemPrompt={prospectSystemPrompt}
        openingLine={openingLine}
        recoveryCondition={recovery}
      />
    </div>
  );
}

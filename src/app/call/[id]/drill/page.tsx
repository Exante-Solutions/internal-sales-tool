import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EVALUATIONS, TRANSCRIPTS, DRILL_SCENARIOS, callById } from "@/data/seed";
import { seededCoachService } from "@/infrastructure/composition";
import { DrillClient } from "@/components/drill-client";

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evaluation = EVALUATIONS[id];
  const transcript = TRANSCRIPTS[id];
  const meta = callById(id);
  if (!evaluation || !transcript || !meta) notFound();

  const moment = seededCoachService().fumbledMoment(evaluation, transcript);
  const scenario = DRILL_SCENARIOS[id];
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
        <h1 className="text-xl font-bold">Voice drill</h1>
        <p className="text-xs text-neutral-500">
          Re-stage the fumbled moment from {meta.prospect}. Recover to raise your score.
        </p>
      </div>
      <DrillClient
        callId={id}
        skill={moment.skill}
        before={moment.before_1_5}
        prospectSystemPrompt={prospectSystemPrompt}
        openingLine={openingLine}
        recoveryCondition={recovery}
      />
    </div>
  );
}

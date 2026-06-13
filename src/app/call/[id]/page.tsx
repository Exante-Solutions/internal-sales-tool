import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EVALUATIONS, TRANSCRIPTS, callById } from "@/data/seed";
import { EvalView } from "@/components/eval-view";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evaluation = EVALUATIONS[id];
  const transcript = TRANSCRIPTS[id];
  const meta = callById(id);
  if (!evaluation || !transcript || !meta) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex items-center gap-1 text-sm text-neutral-400">
        <ChevronLeft className="h-4 w-4" /> Home
      </Link>
      <div>
        <h1 className="text-xl font-bold">{meta.prospect}</h1>
        <p className="text-xs capitalize text-neutral-500">
          {meta.callType} · {meta.contact} · {meta.date}
        </p>
      </div>
      <EvalView evaluation={evaluation} transcript={transcript} />
    </div>
  );
}

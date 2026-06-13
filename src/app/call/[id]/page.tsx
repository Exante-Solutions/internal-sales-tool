import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { resolveCall } from "@/lib/calls";
import { EvalView } from "@/components/eval-view";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveCall(id);
  if (!resolved) notFound();
  const { evaluation, transcript, meta } = resolved;

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

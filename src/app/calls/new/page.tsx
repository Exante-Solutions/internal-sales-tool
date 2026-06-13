import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UploadTranscript } from "@/components/upload-transcript";

export default function NewCallPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex items-center gap-1 text-sm text-neutral-400">
        <ChevronLeft className="h-4 w-4" /> Home
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Score a call</h1>
        <p className="text-sm text-neutral-400">
          Pick a seeded example or paste/upload a transcript — it’s scored against the rubric and added to your calls.
        </p>
      </div>
      <UploadTranscript />
    </div>
  );
}

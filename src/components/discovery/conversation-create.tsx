"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageBack } from "@/components/discovery/page-back";
import { cn } from "@/lib/utils";
import { sendJson } from "@/lib/discovery-api";

type Mode = "pasted" | "manual";

/**
 * Conversation create (SPEC §11.3, §5.1). Two sources:
 *   pasted  — paste/upload a transcript (normalized → IncomingRecording),
 *   manual  — log a meeting from notes (no transcript; playbook check skipped).
 * Posts to /api/conversations, then routes to the new conversation.
 */
export function ConversationCreate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pasted");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
  }

  async function create() {
    setBusy(true);
    setError("");
    const body =
      mode === "pasted"
        ? { source: "pasted", title: title || "Pasted transcript", reasonMd: reason, transcript: text }
        : { source: "manual", title: title || "Logged meeting", reasonMd: reason, notes: text };
    const d = await sendJson<{ conversation?: { id: string } }>("/api/conversations", "POST", body);
    setBusy(false);
    if (d?.conversation?.id) {
      router.push(`/conversations/${d.conversation.id}`);
    } else {
      setError("Could not create the conversation. Is the API wired?");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/conversations" label="Conversations" />
      <h1 className="text-2xl font-bold">New conversation</h1>

      <div className="flex gap-2">
        {(["pasted", "manual"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "min-h-[40px] flex-1 rounded-lg border py-2 text-sm capitalize",
              m === mode ? "border-white bg-neutral-800 text-white" : "border-neutral-800 text-neutral-400",
            )}
          >
            {m === "pasted" ? "Paste transcript" : "Log meeting (notes)"}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for the conversation (optional)"
            className="h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={
              mode === "pasted"
                ? "[00:00] Rep: Thanks for the time…\n[00:11] Prospect: Sure."
                : "Meeting notes — who, what was discussed, outcome…"
            }
            className="resize-none rounded-xl border border-neutral-700 bg-neutral-900 p-3 font-mono text-xs leading-relaxed text-neutral-100 outline-none focus:border-neutral-500"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain"
              onChange={onFile}
              className="hidden"
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="shrink-0">
              <Upload className="h-4 w-4" /> Upload .txt
            </Button>
            <Button onClick={create} disabled={busy || text.trim().length < 10} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create conversation"}
            </Button>
          </div>
          {mode === "manual" && (
            <p className="text-[11px] text-neutral-600">
              Manual meetings have no transcript — the playbook check is skipped.
            </p>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

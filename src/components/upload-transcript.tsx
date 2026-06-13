"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Loader2, ChevronRight } from "lucide-react";
import type { CallType } from "@/domain/rubric";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Example {
  id: string;
  label: string;
  callType: CallType;
  prospect: string;
  contact: string;
  contactRole: string;
}

/**
 * Ingestion UI (Feature 2) — pick a seeded example (the reliable on-ramp) or
 * paste/upload a raw transcript. Posts to /api/calls, which scores + persists
 * it, then routes to the scored call. Reflows to two columns on desktop.
 */
export function UploadTranscript() {
  const router = useRouter();
  const [examples, setExamples] = useState<Example[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  const [callType, setCallType] = useState<CallType>("discovery");
  const [prospect, setProspect] = useState("");
  const [contact, setContact] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.examples && setExamples(d.examples))
      .catch(() => {});
  }, []);

  async function ingest(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "could not score that transcript");
      router.push(`/call/${d.call.meta.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not score that transcript");
      setBusy("");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
      {/* Seeded examples — the reliable on-ramp */}
      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Start from an example</h2>
        {examples.map((ex) => (
          <button key={ex.id} disabled={!!busy} onClick={() => ingest({ exampleId: ex.id }, ex.id)} className="text-left">
            <Card className="transition-colors hover:border-neutral-700">
              <CardContent className="flex items-center gap-3 pt-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15">
                  {busy === ex.id ? <Loader2 className="h-5 w-5 animate-spin text-sky-300" /> : <FileText className="h-5 w-5 text-sky-300" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-100">{ex.prospect}</span>
                    <Badge variant="neutral" className="capitalize">{ex.callType}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500">{ex.contact} · {ex.contactRole}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-600" />
              </CardContent>
            </Card>
          </button>
        ))}
        <p className="px-1 text-[11px] text-neutral-600">Seeded transcripts always work — no typing, no key required.</p>
      </div>

      {/* Paste / upload */}
      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Paste or upload your own</h2>
        <div className="flex gap-2">
          {(["discovery", "demo"] as CallType[]).map((ct) => (
            <button
              key={ct}
              onClick={() => setCallType(ct)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-sm capitalize",
                ct === callType ? "border-white bg-neutral-800 text-white" : "border-neutral-800 text-neutral-400",
              )}
            >
              {ct}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={prospect} onChange={(e) => setProspect(e.target.value)} placeholder="Prospect (e.g. Acme)" className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-sm outline-none focus:border-neutral-600" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact name" className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-sm outline-none focus:border-neutral-600" />
        </div>
        <input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Contact role (e.g. VP Finance)" className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-sm outline-none focus:border-neutral-600" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"[00:00] Rep: Thanks for the time…\n[00:11] Prospect: Sure."}
          className="resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-relaxed outline-none focus:border-neutral-600"
        />
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".txt,.md,text/plain" onChange={onFile} className="hidden" />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="shrink-0">
            <Upload className="h-4 w-4" /> Upload .txt
          </Button>
          <Button
            onClick={() => ingest({ transcript: text, callType, prospect: prospect || "Prospect", contact: contact || "Contact", contactRole }, "paste")}
            disabled={!!busy || text.trim().length < 20}
            className="flex-1"
          >
            {busy === "paste" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Score this call"}
          </Button>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

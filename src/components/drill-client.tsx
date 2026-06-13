"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Sparkles, Loader2, MessageSquare } from "lucide-react";
import type { Rescore } from "@/domain/coaching";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeltaCard } from "@/components/delta-card";
import { VoiceDrill } from "@/components/voice-drill";
import { cn } from "@/lib/utils";

type Turn = { role: "rep" | "prospect"; content: string };
type Mode = "choose" | "voice" | "text";

export function DrillClient({
  callId,
  skill,
  before,
  prospectSystemPrompt,
  openingLine,
  recoveryCondition,
}: {
  callId: string;
  skill: string;
  before: number;
  prospectSystemPrompt: string;
  openingLine: string;
  recoveryCondition: string;
}) {
  const [mode, setMode] = useState<Mode>("choose");

  if (mode === "voice") {
    return (
      <VoiceDrill
        callId={callId}
        skill={skill}
        before={before}
        prospectSystemPrompt={prospectSystemPrompt}
        openingLine={openingLine}
        onTextFallback={() => setMode("text")}
      />
    );
  }

  if (mode === "text") {
    return <TextDrill callId={callId} skill={skill} before={before} openingLine={openingLine} recoveryCondition={recoveryCondition} />;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Badge variant="redo">Drilling: {skill}</Badge>
        <p className="text-sm text-neutral-300">
          The AI prospect re-stages the exact fumbled moment. Recover by: <span className="text-neutral-100">{recoveryCondition}</span>
        </p>
        <Button size="lg" onClick={() => setMode("voice")}>
          <Mic className="h-4 w-4" /> Start voice drill
        </Button>
        <Button variant="secondary" onClick={() => setMode("text")}>
          <MessageSquare className="h-4 w-4" /> Use text drill instead
        </Button>
      </CardContent>
    </Card>
  );
}

function TextDrill({
  callId,
  skill,
  before,
  openingLine,
  recoveryCondition,
}: {
  callId: string;
  skill: string;
  before: number;
  openingLine: string;
  recoveryCondition: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([{ role: "prospect", content: openingLine }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [rescore, setRescore] = useState<Rescore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, rescore]);

  async function send() {
    const repTurn = input.trim();
    if (!repTurn || sending) return;
    setError("");
    setSending(true);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "rep", content: repTurn }]);
    setInput("");
    try {
      const res = await fetch("/api/drill/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, history, repTurn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "drill turn failed");
      setTurns((t) => [...t, { role: "prospect", content: data.reply }]);
      if (data.recovered) setRecovered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "drill turn failed");
    } finally {
      setSending(false);
    }
  }

  async function endAndScore() {
    setScoring(true);
    setError("");
    const drillTranscript = turns.map((t) => `${t.role === "rep" ? "Rep" : "Prospect"}: ${t.content}`).join("\n");
    try {
      const res = await fetch("/api/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, drillTranscript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "rescore failed");
      setRescore(data.rescore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "rescore failed");
    } finally {
      setScoring(false);
    }
  }

  if (rescore) {
    return (
      <div className="flex flex-col gap-4">
        <DeltaCard rescore={rescore} />
        <p className="text-center text-xs text-neutral-500">
          This gain is computed on the same rubric anchors as the original call — scoped to one skill.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge variant="redo">Text drill: {skill}</Badge>
        <span className="text-xs text-neutral-500">before {before}/5</span>
      </div>
      <p className="text-[11px] leading-relaxed text-neutral-500">Recover by: {recoveryCondition}</p>

      <div className="flex flex-col gap-2">
        {turns.map((t, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              t.role === "rep" ? "self-end bg-sky-600/80 text-white" : "self-start bg-neutral-800 text-neutral-100",
            )}
          >
            {t.content}
          </div>
        ))}
        {sending && (
          <div className="self-start rounded-2xl bg-neutral-800 px-3 py-2 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {recovered && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" /> Prospect is conceding — end the drill to lock your gain.
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Your response to the prospect…"
          className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="h-11 w-11 p-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <Button variant="secondary" onClick={endAndScore} disabled={scoring || turns.length < 2}>
        {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
        {scoring ? "Scoring your drill…" : "End drill & score"}
      </Button>
    </div>
  );
}

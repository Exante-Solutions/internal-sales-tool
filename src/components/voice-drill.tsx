"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";
import type { Rescore } from "@/domain/coaching";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeltaCard } from "@/components/delta-card";
import { cn } from "@/lib/utils";

type Line = { source: "user" | "ai"; message: string };

function VoiceDrillInner({
  callId,
  skill,
  before,
  prospectSystemPrompt,
  openingLine,
  onTextFallback,
}: {
  callId: string;
  skill: string;
  before: number;
  prospectSystemPrompt: string;
  openingLine: string;
  onTextFallback: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [phase, setPhase] = useState<"idle" | "connecting" | "live" | "scoring" | "done">("idle");
  const [rescore, setRescore] = useState<Rescore | null>(null);
  const [error, setError] = useState("");

  const conversation = useConversation({
    onMessage: ({ message, source }) => setLines((l) => [...l, { source, message }]),
    onError: (msg) => setError(typeof msg === "string" ? msg : "voice error"),
    onDisconnect: () => setPhase((p) => (p === "live" ? "idle" : p)),
  });

  async function start() {
    setError("");
    setPhase("connecting");
    try {
      // Mic must be requested inside the same user gesture (iOS Safari).
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/drill/token", { method: "POST" });
      if (!res.ok) {
        onTextFallback();
        return;
      }
      const { signedUrl } = (await res.json()) as { signedUrl?: string };
      if (!signedUrl) {
        onTextFallback();
        return;
      }
      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: {
          agent: { prompt: { prompt: prospectSystemPrompt }, firstMessage: openingLine },
        },
      });
      setPhase("live");
    } catch {
      setError("Couldn't start the voice session — mic permission or network. Falling back to text.");
      setPhase("idle");
    }
  }

  async function end() {
    setPhase("scoring");
    try {
      conversation.endSession();
    } catch {
      /* already closed */
    }
    const drillTranscript = lines.map((l) => `${l.source === "user" ? "Rep" : "Prospect"}: ${l.message}`).join("\n");
    try {
      const res = await fetch("/api/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, drillTranscript: drillTranscript || "(no speech captured)" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "rescore failed");
      setRescore(data.rescore);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "rescore failed");
      setPhase("live");
    }
  }

  if (phase === "done" && rescore) {
    return (
      <div className="flex flex-col gap-4">
        <DeltaCard rescore={rescore} />
        <p className="text-center text-xs text-neutral-500">Scored on the same rubric anchors — scoped to one skill.</p>
      </div>
    );
  }

  const speaking = conversation.isSpeaking;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-5">
          <Badge variant="redo">Drilling: {skill}</Badge>
          {/* Agent-state orb */}
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-all",
                phase === "live" && speaking ? "animate-ping bg-sky-500/30" : "bg-transparent",
              )}
            />
            <span
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full border transition-colors",
                phase === "live"
                  ? speaking
                    ? "border-sky-400 bg-sky-500/20"
                    : "border-emerald-400 bg-emerald-500/10"
                  : "border-neutral-700 bg-neutral-900",
              )}
            >
              <Mic className={cn("h-8 w-8", phase === "live" ? "text-sky-300" : "text-neutral-500")} />
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            {phase === "idle" && "Tap to start — we’ll ask for your mic. The AI prospect re-stages the moment."}
            {phase === "connecting" && "Connecting to the prospect…"}
            {phase === "live" && (speaking ? "Prospect speaking…" : "Listening — your turn")}
            {phase === "scoring" && "Scoring your drill…"}
          </p>

          {phase === "idle" && (
            <Button size="lg" className="w-full" onClick={start}>
              <Mic className="h-4 w-4" /> Start voice drill
            </Button>
          )}
          {phase === "connecting" && (
            <Button size="lg" className="w-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
            </Button>
          )}
          {phase === "live" && (
            <Button size="lg" variant="secondary" className="w-full" onClick={end}>
              <Square className="h-4 w-4" /> End drill & score
            </Button>
          )}
          {phase === "scoring" && (
            <Button size="lg" className="w-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" /> Scoring…
            </Button>
          )}
          <span className="text-[11px] text-neutral-600">before {before}/5 · powered by Claude via ElevenLabs</span>
        </CardContent>
      </Card>

      {/* Live transcript */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                l.source === "user" ? "self-end bg-sky-600/80 text-white" : "self-start bg-neutral-800 text-neutral-100",
              )}
            >
              {l.message}
            </div>
          ))}
        </div>
      )}

      {phase === "live" && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-500">
          <Sparkles className="h-3 w-3" /> Quantify the pain to recover — name a $ figure or DSO and the prospect concedes.
        </p>
      )}
      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-rose-400">{error}</p>
          <Button variant="ghost" onClick={onTextFallback}>
            Switch to text drill
          </Button>
        </div>
      )}
    </div>
  );
}

export function VoiceDrill(props: {
  callId: string;
  skill: string;
  before: number;
  prospectSystemPrompt: string;
  openingLine: string;
  onTextFallback: () => void;
}) {
  return (
    <ConversationProvider>
      <VoiceDrillInner {...props} />
    </ConversationProvider>
  );
}

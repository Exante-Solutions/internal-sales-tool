"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Lightbulb, Quote, ArrowRight } from "lucide-react";
import type { CoachBriefing } from "@/domain/briefing";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Coach prep (Feature 1) — a sales-leader debrief before the roleplay. Loads a
 * grounded briefing (what happened, the one move, a script line), lets the rep
 * ask ONE follow-up, then hands off to the simulation. Fast on purpose.
 */
export function CoachPrep({
  callId,
  skillId,
  skill,
  onReady,
}: {
  callId: string;
  skillId: number;
  skill: string;
  onReady: () => void;
}) {
  const [briefing, setBriefing] = useState<CoachBriefing | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/coach/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId, skillId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.briefing) setBriefing(d.briefing);
        else setError(d.error ?? "could not load the coach");
      })
      .catch(() => alive && setError("could not reach the coach"));
    return () => {
      alive = false;
    };
  }, [callId, skillId]);

  async function ask() {
    const q = question.trim();
    if (!q || asking || !briefing) return;
    setAsking(true);
    setError("");
    try {
      const res = await fetch("/api/coach/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, question: q, briefing }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "the coach didn't answer");
      setAnswer(d.answer);
      setAsked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "the coach didn't answer");
    } finally {
      setAsking(false);
    }
  }

  if (!briefing) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 pt-4 text-sm text-neutral-400">
          {error ? (
            <span className="text-rose-400">{error}</span>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Your coach is reviewing the call…
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-amber-300" />
        <Badge variant="needs_work">Coaching session</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <p className="text-sm leading-relaxed text-neutral-200">{briefing.situation}</p>

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">The one move</p>
              <p className="mt-0.5 text-sm text-neutral-100">{briefing.the_move}</p>
            </div>
          </div>

          {briefing.sample_line && (
            <div className="flex items-start gap-2 text-sm text-neutral-300">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <p className="italic">{briefing.sample_line}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* One follow-up */}
      {answer && (
        <Card>
          <CardContent className="pt-4 text-sm leading-relaxed text-neutral-200">{answer}</CardContent>
        </Card>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!asked && (
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            rows={2}
            placeholder="Ask the coach one thing… (optional)"
            className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
          />
          <Button variant="secondary" onClick={ask} disabled={asking || !question.trim()} className="h-11 shrink-0">
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </div>
      )}

      <Button size="lg" onClick={onReady}>
        I’m ready — start the roleplay <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-[11px] text-neutral-600">
        {skill} · the buyer won’t announce it — you’ll have to navigate there.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ClipboardList, Sparkles, Loader2, Quote, Target, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBack } from "@/components/discovery/page-back";
import { PeoplePicker } from "@/components/discovery/people-picker";
import { FollowUpList } from "@/components/discovery/follow-up-list";
import { ScoreRing, bandLabel } from "@/components/score-ring";
import { cn, formatTs } from "@/lib/utils";
import {
  getJson,
  sendJson,
  fmtDate,
  type ParticipantView,
  type FollowUpView,
  type TranscriptSeg,
  type InitiativeView,
} from "@/lib/discovery-api";

interface DiscoveryFields {
  summary?: string;
  whatWeLearned?: string[];
  signals?: string[];
  nextSteps?: string[];
  reasonMd?: string;
  outcomeMd?: string;
}

interface PlaybookItem {
  rubric_item_id: number;
  name: string;
  score_1_5: number;
  rationale: string;
  cite_ts_seconds: number;
  cite_quote: string;
}
interface PlaybookEvaluation {
  score_100: number;
  band: "strong" | "needs_work" | "redo";
  headline?: string;
  items: PlaybookItem[];
}

interface ConversationDetailResponse {
  conversation?: {
    id: string;
    title: string;
    source: string;
    occurredAt?: string;
    reasonMd?: string;
    outcomeMd?: string;
    initiativeIds?: string[];
  };
  participants?: ParticipantView[];
  recorderSummaryMd?: string;
  recorderActionItems?: string[];
  discoveryFields?: DiscoveryFields;
  followUps?: FollowUpView[];
  segments?: TranscriptSeg[];
  coachingEvaluation?: PlaybookEvaluation | null;
  initiatives?: InitiativeView[];
}

function scoreDot(score: number) {
  if (score >= 4) return "bg-emerald-400";
  if (score === 3) return "bg-amber-400";
  return "bg-rose-400";
}

export function ConversationDetail({ id }: { id: string }) {
  const [data, setData] = useState<ConversationDetailResponse>({});
  const [evaluation, setEvaluation] = useState<PlaybookEvaluation | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  async function load() {
    const d = await getJson<ConversationDetailResponse>(`/api/conversations/${id}`);
    if (d) {
      setData(d);
      if (d.coachingEvaluation) setEvaluation(d.coachingEvaluation);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const conv = data.conversation;
  const participants = data.participants ?? [];
  const fields = data.discoveryFields ?? {};
  const followUps = data.followUps ?? [];
  const segments = data.segments ?? [];
  const isManual = conv?.source === "manual";

  const allInitiatives = data.initiatives ?? [];
  const linkedIds = new Set(conv?.initiativeIds ?? []);
  const linkedInitiatives = allInitiatives.filter((i) => linkedIds.has(i.id));
  const availableInitiatives = allInitiatives.filter((i) => !linkedIds.has(i.id));
  const [assigning, setAssigning] = useState(false);

  // ── Participants: add (people-picker) / remove (B2) ──────────────────────
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantBusy, setParticipantBusy] = useState(false);

  async function addParticipant(personId: string) {
    if (!personId) return;
    setParticipantBusy(true);
    await sendJson(`/api/conversations/${id}/participants`, "POST", { personId });
    setParticipantBusy(false);
    setAddingParticipant(false);
    load();
  }
  async function removeParticipant(personId: string) {
    setParticipantBusy(true);
    await sendJson(`/api/conversations/${id}/participants/${personId}`, "DELETE");
    setParticipantBusy(false);
    load();
  }

  // ── On-demand discovery analysis (B3, locked: button not auto) ───────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  async function runDiscoveryAnalysis() {
    setAnalyzing(true);
    setAnalyzeError("");
    const d = await sendJson(`/api/conversations/${id}/analyze`, "POST");
    setAnalyzing(false);
    if (d) load();
    else setAnalyzeError("Could not run discovery analysis.");
  }

  async function assignInitiative(initiativeId: string) {
    if (!initiativeId) return;
    setAssigning(true);
    await sendJson(`/api/conversations/${id}/initiatives`, "POST", { initiativeId });
    setAssigning(false);
    load();
  }
  async function removeInitiative(initiativeId: string) {
    setAssigning(true);
    await sendJson(`/api/conversations/${id}/initiatives`, "DELETE", { initiativeId });
    setAssigning(false);
    load();
  }

  async function runPlaybook() {
    setRunning(true);
    setRunError("");
    const d = await sendJson<{ evaluation?: PlaybookEvaluation }>(
      `/api/conversations/${id}/playbook-check`,
      "POST",
    );
    setRunning(false);
    if (d?.evaluation) setEvaluation(d.evaluation);
    else setRunError("Could not run the playbook check.");
  }

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/conversations" label="Conversations" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{conv?.title ?? "Conversation"}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {conv?.source && (
            <Badge variant="neutral" className="capitalize">{conv.source}</Badge>
          )}
          {conv?.occurredAt && <span>{fmtDate(conv.occurredAt)}</span>}
        </div>
        {conv?.reasonMd && (
          <p className="text-sm leading-relaxed text-neutral-400">
            <span className="font-semibold uppercase tracking-wide text-neutral-500">Why:</span>{" "}
            {conv.reasonMd}
          </p>
        )}
        {conv?.outcomeMd && (
          <p className="text-sm leading-relaxed text-neutral-400">
            <span className="font-semibold uppercase tracking-wide text-neutral-500">Outcome:</span>{" "}
            {conv.outcomeMd}
          </p>
        )}
      </header>

      {/* Assign / remove this conversation to/from initiatives (§18.7, U1/U2) */}
      <section data-region="initiative-assign" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Target className="h-3.5 w-3.5" /> Initiatives
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {linkedInitiatives.length === 0 ? (
              <p data-empty-state className="text-sm text-neutral-400">
                Not assigned to any initiative — this conversation is in the Unassigned inbox.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {linkedInitiatives.map((i) => (
                  <li key={i.id}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 py-1 pl-3 pr-1 text-xs text-neutral-200">
                      <Link href={`/initiatives/${i.id}`} className="hover:underline">
                        {i.name}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove from ${i.name}`}
                        disabled={assigning}
                        onClick={() => removeInitiative(i.id)}
                        className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {availableInitiatives.length > 0 && (
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0 text-neutral-500" />
                <select
                  defaultValue=""
                  disabled={assigning}
                  onChange={(e) => {
                    const v = e.target.value;
                    e.currentTarget.value = "";
                    assignInitiative(v);
                  }}
                  aria-label="Assign to an initiative"
                  className="h-9 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none focus:border-neutral-500"
                >
                  <option value="" disabled>
                    Assign to an initiative…
                  </option>
                  {availableInitiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Participants — with company-at-time snapshot (M3, D3); add/remove (B2) */}
      <section data-region="participants" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Users className="h-3.5 w-3.5" /> Participants
          </h2>
          <div data-region="add-participant">
            <Button
              size="sm"
              variant="ghost"
              disabled={participantBusy}
              onClick={() => setAddingParticipant((v) => !v)}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {addingParticipant && (
          <PeoplePicker
            busy={participantBusy}
            onSelectExisting={(personId) => addParticipant(personId)}
            onCreateNew={(displayName, email) => {
              // A participant must be an existing person (snapshot needs a
              // membership). Create the person first, then add them.
              sendJson<{ person?: { id: string } }>("/api/people", "POST", {
                displayName,
                email: email ?? `${displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.invalid`,
              }).then((r) => {
                if (r?.person?.id) addParticipant(r.person.id);
              });
            }}
          />
        )}

        {participants.length === 0 ? (
          <Card>
            <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
              No participants yet. Add a person to attach them — their company and role are snapshotted at the conversation time.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {participants.map((p) => (
                <li key={p.personId} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/people/${p.personId}`}
                      className="block truncate text-sm font-medium text-neutral-100 hover:underline"
                    >
                      {p.personName ?? p.emailUsed}
                    </Link>
                    <p className="truncate text-xs text-neutral-500">{p.emailUsed}</p>
                  </div>
                  {(p.companyName || p.companyAtTime) && (
                    <Badge variant="neutral" className="shrink-0 text-[10px]" title="Company at conversation time">
                      {p.companyName ?? p.companyAtTime}
                      {p.roleAtTime ? ` · ${p.roleAtTime}` : ""}
                    </Badge>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${p.personName ?? p.emailUsed}`}
                    disabled={participantBusy}
                    onClick={() => removeParticipant(p.personId)}
                    className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Recorder summary + action items (G1) */}
      <section data-region="recorder-summary" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <ClipboardList className="h-3.5 w-3.5" /> Recorder summary
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            {data.recorderSummaryMd ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                {data.recorderSummaryMd}
              </p>
            ) : (
              <p data-empty-state className="text-sm text-neutral-400">
                Populated by a recorder (Circleback); not available for pasted/manual conversations.
              </p>
            )}
            {data.recorderActionItems && data.recorderActionItems.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {data.recorderActionItems.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Discovery fields (G3) — on-demand analysis (B3, locked: button) */}
      <section data-region="discovery-fields" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Discovery fields
          </h2>
          <div data-region="run-discovery-analysis">
            <Button size="sm" variant="ghost" onClick={runDiscoveryAnalysis} disabled={analyzing}>
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {analyzing ? "Analyzing…" : "Run discovery analysis"}
            </Button>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            {fields.summary && (
              <p className="text-sm leading-relaxed text-neutral-300">{fields.summary}</p>
            )}
            <FieldList label="What we learned" items={fields.whatWeLearned} />
            <FieldList label="Signals" items={fields.signals} />
            <FieldList label="Next steps" items={fields.nextSteps} />
            {!fields.summary &&
              !fields.whatWeLearned?.length &&
              !fields.signals?.length &&
              !fields.nextSteps?.length && (
                <p data-empty-state className="text-sm text-neutral-400">
                  Run discovery analysis to extract summary, signals, and next steps.
                </p>
              )}
            {analyzeError && <p className="text-sm text-rose-400">{analyzeError}</p>}
          </CardContent>
        </Card>
      </section>

      {/* Run playbook check — on-demand coaching add-on (M3, H1/H3) */}
      <section data-region="run-playbook-check" className="flex flex-col gap-3">
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-violet-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Playbook check</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              {isManual
                ? "Manual meetings have no transcript — the playbook score is skipped."
                : "Run the rubric evaluation on this transcript — scored 0–100 with cited moments."}
            </p>
            <Button onClick={runPlaybook} disabled={running || isManual} className="w-full">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run playbook check"}
            </Button>
            {runError && <p className="text-sm text-rose-400">{runError}</p>}
          </CardContent>
        </Card>

        {evaluation && (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <ScoreRing score={evaluation.score_100} band={evaluation.band} />
                <Badge variant={evaluation.band}>{bandLabel[evaluation.band]}</Badge>
                {evaluation.headline && (
                  <p className="text-sm font-medium text-neutral-200">{evaluation.headline}</p>
                )}
              </div>
              <ul className="divide-y divide-neutral-800">
                {evaluation.items.map((item) => (
                  <li key={item.rubric_item_id} className="flex items-start gap-3 p-3">
                    <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", scoreDot(item.score_1_5))} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-100">{item.name}</p>
                      <p className="text-xs text-neutral-500">{item.rationale}</p>
                      {item.cite_quote && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] italic text-neutral-400">
                          <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            “{item.cite_quote}” <span className="text-sky-400">@ {formatTs(item.cite_ts_seconds)}</span>
                          </span>
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-200">
                      {item.score_1_5}/5
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Follow-ups — lifecycle: complete / archive (G4, §18.6) */}
      <section data-region="follow-ups" className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Follow-ups
        </h2>
        <FollowUpList conversationId={id} followUps={followUps} onChange={load} />
      </section>

      {/* Transcript — the recorded call (speaker · text · timestamp), BUG_FIX B10.
          Manual meetings have no transcript; non-manual calls without segments
          show a neutral empty state. */}
      <section data-region="transcript" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Quote className="h-3.5 w-3.5" /> Transcript
        </h2>
        <Card>
          {segments.length === 0 ? (
            <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
              {isManual
                ? "Manual meetings have no transcript."
                : "No transcript available."}
            </CardContent>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {segments.map((seg, idx) => (
                <li key={idx} className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-200">
                      {seg.speaker}
                    </span>
                    <span className="text-[11px] tabular-nums text-sky-400">
                      {formatTs(seg.ts)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                    {seg.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function FieldList({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

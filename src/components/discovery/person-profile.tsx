"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Building2,
  Clock,
  Sparkles,
  StickyNote,
  RefreshCw,
  Loader2,
  GitMerge,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBack } from "@/components/discovery/page-back";
import { cn } from "@/lib/utils";
import {
  getJson,
  sendJson,
  fmtDate,
  type MembershipView,
  type TimelineEntryView,
  type ProfileSummaryView,
} from "@/lib/discovery-api";

interface EmailIdentityView {
  id?: string;
  emailNormalized: string;
  label?: string;
  verified?: boolean;
}
interface MergeSuggestionView {
  personId: string;
  personName?: string;
  confidence?: number;
  reason?: string;
}
interface PersonResponse {
  person?: { id: string; primaryDisplayName: string };
  emails?: EmailIdentityView[];
  memberships?: MembershipView[];
  timeline?: TimelineEntryView[];
  summary?: ProfileSummaryView | null;
  mergeSuggestions?: MergeSuggestionView[];
}

const KIND_DOT: Record<string, string> = {
  conversation: "bg-sky-400",
  email: "bg-violet-400",
  calendar: "bg-amber-400",
  note: "bg-neutral-400",
};

export function PersonProfile({ id }: { id: string }) {
  const [data, setData] = useState<PersonResponse>({});
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [emailFilter, setEmailFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Tracks the id the component is currently mounted for. A reload after a
  // mutation (sync/notes/merge/regenerate) refetches `${id}` captured when the
  // mutation started; if the user navigates to another person mid-request, the
  // response must be dropped rather than overwrite the newly-opened profile
  // (3425263998).
  const currentId = useRef(id);
  currentId.current = id;

  async function load() {
    const reloadId = id;
    const d = await getJson<PersonResponse>(`/api/people/${reloadId}`);
    // Ignore the response if we've since navigated to a different person.
    if (d && currentId.current === reloadId) setData(d);
  }
  useEffect(() => {
    // Reset state (and timeline filters) so the previous person doesn't flash,
    // and ignore stale responses if `id` changes before the fetch resolves.
    let active = true;
    setData({});
    setEmailFilter("all");
    setCompanyFilter("all");
    (async () => {
      const d = await getJson<PersonResponse>(`/api/people/${id}`);
      if (active && d) setData(d);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const emails = data.emails ?? [];
  const memberships = useMemo(() => data.memberships ?? [], [data.memberships]);
  const timeline = useMemo(() => data.timeline ?? [], [data.timeline]);
  const summary = data.summary;
  const suggestions = data.mergeSuggestions ?? [];

  const companies = useMemo(
    () =>
      Array.from(
        new Map(memberships.map((m) => [m.companyId, m.companyName ?? m.companyId])).entries(),
      ),
    [memberships],
  );

  // Filters scope the timeline view (D6). They match against optional metadata
  // the API may attach to an entry; when absent, the entry passes (non-
  // destructive defaults), so a single email/company narrows without hiding
  // everything.
  const filteredTimeline = useMemo(() => {
    return timeline.filter((t) => {
      const e = t as TimelineEntryView & { emailUsed?: string; companyId?: string };
      const emailOk = emailFilter === "all" || !e.emailUsed || e.emailUsed === emailFilter;
      const companyOk = companyFilter === "all" || !e.companyId || e.companyId === companyFilter;
      return emailOk && companyOk;
    });
  }, [timeline, emailFilter, companyFilter]);

  async function syncEmails() {
    const reqId = id;
    setSyncing(true);
    await sendJson(`/api/people/${id}/sync-emails`, "POST");
    // Drop the result if the user navigated to another person mid-request.
    if (currentId.current !== reqId) return;
    setSyncing(false);
    load();
  }

  async function regenerate() {
    const reqId = id;
    setRegenerating(true);
    await sendJson(`/api/profiles/person/${id}/regenerate`, "POST");
    if (currentId.current !== reqId) return;
    setRegenerating(false);
    load();
  }

  async function addNote() {
    if (!note.trim()) return;
    const reqId = id;
    await sendJson(`/api/people/${id}`, "PATCH", { note: note.trim() });
    if (currentId.current !== reqId) return;
    setNote("");
    setAddingNote(false);
    load();
  }

  async function confirmMerge(otherId: string) {
    const reqId = id;
    await sendJson(`/api/people/${id}/merge`, "POST", { absorbedId: otherId });
    if (currentId.current !== reqId) return;
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/people" label="People" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{data.person?.primaryDisplayName ?? "Person"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={syncEmails} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Sync emails
          </Button>
        </div>
      </header>

      {/* Merge suggestions — human-confirmed only, never silent (C2/C6) */}
      {suggestions.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-amber-300">
              <GitMerge className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Possible matches</span>
            </div>
            {suggestions.map((s) => (
              <div key={s.personId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-100">{s.personName ?? s.personId}</p>
                  {s.reason && <p className="truncate text-xs text-neutral-500">{s.reason}</p>}
                </div>
                <Button size="sm" onClick={() => confirmMerge(s.personId)}>
                  Merge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Identities (M4) */}
      <section data-region="identities" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Mail className="h-3.5 w-3.5" /> Email identities
        </h2>
        {emails.length === 0 ? (
          <Card data-empty-state="person-emails">
            <CardContent className="flex flex-col items-start gap-2 pt-4">
              <p className="text-sm font-medium text-neutral-200">No emails on file</p>
              <p className="text-xs text-neutral-500">
                Email identities arrive from call participants and mailbox sync.
                Sync emails to pull this person&apos;s threads across connected
                mailboxes.
              </p>
              <Button size="sm" variant="secondary" className="mt-1" onClick={syncEmails} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Sync emails
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {emails.map((e, idx) => (
                <li key={e.id ?? e.emailNormalized ?? idx} className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
                    {e.emailNormalized}
                  </span>
                  {e.label && (
                    <Badge variant="neutral" className="shrink-0 text-[10px]">{e.label}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Memberships with history (M4, D2) */}
      <section data-region="memberships" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Building2 className="h-3.5 w-3.5" /> Company memberships
        </h2>
        {memberships.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-neutral-400">No memberships.</CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {memberships.map((m, i) => (
                <li key={i} className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/companies/${m.companyId}`}
                      className="block truncate text-sm font-medium text-neutral-100 hover:underline"
                    >
                      {m.companyName ?? m.companyId}
                    </Link>
                    <p className="truncate text-xs text-neutral-500">
                      {m.title ?? "—"}
                      {m.startedOn ? ` · ${fmtDate(m.startedOn)}` : ""}
                      {m.endedOn ? ` – ${fmtDate(m.endedOn)}` : m.isCurrent ? " – present" : ""}
                    </p>
                  </div>
                  {m.isCurrent && (
                    <Badge variant="strong" className="shrink-0 text-[10px]">current</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Filters: by email, by company (D6) */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="h-9 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none focus:border-neutral-500"
        >
          <option value="all">All emails</option>
          {emails.map((e, idx) => (
            <option key={e.id ?? e.emailNormalized ?? idx} value={e.emailNormalized}>
              {e.emailNormalized}
            </option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="h-9 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none focus:border-neutral-500"
        >
          <option value="all">All companies</option>
          {companies.map(([cid, cname]) => (
            <option key={cid} value={cid}>
              {cname}
            </option>
          ))}
        </select>
      </div>

      {/* AI summary — derived rollup (M4, I2) */}
      <section data-region="ai-summary" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Sparkles className="h-3.5 w-3.5" /> AI summary
          </h2>
          <Button size="sm" variant="ghost" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            {summary?.summaryMd ? (
              <>
                <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                  {summary.summaryMd}
                </p>
                {typeof summary.sourceEntryCount === "number" && (
                  <p className="text-[11px] text-neutral-600">
                    Rolled up from {summary.sourceEntryCount} timeline entr
                    {summary.sourceEntryCount === 1 ? "y" : "ies"}
                    {summary.generatedAt ? ` · ${fmtDate(summary.generatedAt)}` : ""}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                No summary yet — regenerate to roll up the timeline.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Manual notes — first-class timeline entries (M4, I3) */}
      <section data-region="notes" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <StickyNote className="h-3.5 w-3.5" /> Notes
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setAddingNote((v) => !v)}>
            <Plus className="h-4 w-4" /> Add note
          </Button>
        </div>
        {addingNote && (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Write a note…"
                className="resize-none rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addNote} disabled={!note.trim()}>
                  Save note
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingNote(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {timeline.filter((t) => t.kind === "note").length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-neutral-400">No notes yet.</CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {timeline
                .filter((t) => t.kind === "note")
                .map((t) => (
                  <li key={t.id} className="p-3">
                    <p className="text-sm text-neutral-200">{t.bodyMd}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-600">{fmtDate(t.occurredAt)}</p>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Timeline — append-only source of truth (M4, I1) */}
      <section data-region="timeline" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Clock className="h-3.5 w-3.5" /> Timeline
        </h2>
        {filteredTimeline.length === 0 ? (
          <Card data-empty-state="person-timeline">
            <CardContent className="flex flex-col items-start gap-1 pt-4">
              <p className="text-sm font-medium text-neutral-200">
                {timeline.length === 0 ? "No timeline entries yet" : "No entries match these filters"}
              </p>
              <p className="text-xs text-neutral-500">
                {timeline.length === 0
                  ? "The timeline aggregates calls, emails, calendar events, and notes. Sync emails or add a note to populate it."
                  : "Try widening the email or company filter above to see more entries."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {filteredTimeline.map((t) => (
                <li key={t.id} className="flex items-start gap-3 p-3">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", KIND_DOT[t.kind] ?? "bg-neutral-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="text-[10px] capitalize">{t.kind}</Badge>
                      <span className="text-[11px] text-neutral-600">{fmtDate(t.occurredAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                      {t.bodyMd}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Sync emails control — on-demand pull (M4, J1) */}
      <section data-region="sync-emails">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Mail className="h-4 w-4 shrink-0 text-violet-300" />
            <p className="flex-1 text-xs text-neutral-400">
              Pull this person&apos;s threads across all connected team mailboxes and persist them
              permanently.
            </p>
            <Button size="sm" onClick={syncEmails} disabled={syncing} className="shrink-0">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sync emails"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

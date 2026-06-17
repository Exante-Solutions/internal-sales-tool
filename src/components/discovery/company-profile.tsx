"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, Clock, Sparkles, MessagesSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageBack } from "@/components/discovery/page-back";
import { cn } from "@/lib/utils";
import {
  getJson,
  fmtDate,
  type TimelineEntryView,
  type ProfileSummaryView,
  type ConversationListItem,
} from "@/lib/discovery-api";

interface CompanyMemberView {
  id: string;
  primaryDisplayName: string;
}
interface CompanyMembershipView {
  personId: string;
  title?: string | null;
  isCurrent?: boolean;
}
interface CompanyResponse {
  company?: { id: string; name: string; domain?: string | null };
  members?: CompanyMemberView[];
  memberships?: CompanyMembershipView[];
  timeline?: TimelineEntryView[];
  summary?: ProfileSummaryView | null;
  conversations?: ConversationListItem[];
}

const KIND_DOT: Record<string, string> = {
  conversation: "bg-sky-400",
  email: "bg-violet-400",
  calendar: "bg-amber-400",
  note: "bg-neutral-400",
};

export function CompanyProfile({ id }: { id: string }) {
  const [data, setData] = useState<CompanyResponse>({});

  useEffect(() => {
    // Reset state so the previous company doesn't flash, and ignore stale
    // responses if `id` changes before the fetch resolves (out-of-order guard).
    let active = true;
    setData({});
    getJson<CompanyResponse>(`/api/companies/${id}`).then((d) => {
      if (active && d) setData(d);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const company = data.company;
  const members = data.members ?? [];
  const memberships = data.memberships ?? [];
  const timeline = data.timeline ?? [];
  const summary = data.summary;
  const conversations = data.conversations ?? [];

  // The API returns `members` as Person records and a separate `memberships`
  // array. Join them by personId to derive each member's title and current/past
  // status; a member with no matching current membership is treated as past.
  const membershipByPerson = new Map(memberships.map((m) => [m.personId, m]));
  const decorated = members.map((m) => {
    const ms = membershipByPerson.get(m.id);
    return { ...m, title: ms?.title ?? null, isCurrent: ms?.isCurrent ?? false };
  });
  const current = decorated.filter((m) => m.isCurrent);
  const past = decorated.filter((m) => !m.isCurrent);

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/people" label="People" />

      <header className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-sky-400" />
        <h1 className="text-2xl font-bold">{company?.name ?? "Company"}</h1>
        {company?.domain && (
          <Badge variant="neutral" className="text-[10px]">{company.domain}</Badge>
        )}
      </header>

      {/* People — current + past members */}
      <section data-region="people-view" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Users className="h-3.5 w-3.5" /> People
        </h2>
        {members.length === 0 ? (
          <Card data-empty-state="company-people">
            <CardContent className="flex flex-col items-start gap-1 pt-4">
              <p className="text-sm font-medium text-neutral-200">No members on file</p>
              <p className="text-xs text-neutral-500">
                People are linked to this company through their memberships. They
                appear here once a profile lists this company — current or past.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {[...current, ...past].map((m) => (
                <li key={m.id} className="flex items-center gap-2 p-3">
                  <Link
                    href={`/people/${m.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-neutral-100 hover:underline"
                  >
                    {m.primaryDisplayName}
                    {m.title ? <span className="text-neutral-500"> · {m.title}</span> : null}
                  </Link>
                  <Badge variant={m.isCurrent ? "strong" : "neutral"} className="shrink-0 text-[10px]">
                    {m.isCurrent ? "current" : "past"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* AI summary — aggregated rollup */}
      <section data-region="ai-summary" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" /> AI summary
        </h2>
        <Card>
          <CardContent className="pt-4">
            {summary?.summaryMd ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                {summary.summaryMd}
              </p>
            ) : (
              <p className="text-sm text-neutral-400">No summary yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Linked conversations across members */}
      <section data-region="linked-conversations" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <MessagesSquare className="h-3.5 w-3.5" /> Conversations
        </h2>
        {conversations.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-neutral-400">No conversations yet.</CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => (
              <Link key={c.id} href={`/conversations/${c.id}`}>
                <Card className="transition-colors hover:border-neutral-700">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <MessagesSquare className="h-4 w-4 shrink-0 text-sky-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-100">{c.title}</p>
                      <p className="text-xs text-neutral-500">
                        {[c.source, c.occurredAt ? fmtDate(c.occurredAt) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Timeline — aggregated over current + past members (I4) */}
      <section data-region="timeline" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Clock className="h-3.5 w-3.5" /> Timeline
        </h2>
        {timeline.length === 0 ? (
          <Card data-empty-state="company-timeline">
            <CardContent className="flex flex-col items-start gap-1 pt-4">
              <p className="text-sm font-medium text-neutral-200">No timeline entries yet</p>
              <p className="text-xs text-neutral-500">
                This timeline aggregates activity across the company&apos;s
                current and past members. It fills in as their calls, emails, and
                notes accrue.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {timeline.map((t) => (
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
    </div>
  );
}

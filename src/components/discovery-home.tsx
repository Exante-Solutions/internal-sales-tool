"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@/domain/session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Glyph } from "@/components/ui/glyph";
import { Eyebrow } from "@/components/ui/typography";
import {
  getJson,
  fmtDate,
  statusLabel,
  type InitiativeView,
  type ConversationListItem,
} from "@/lib/discovery-api";

/**
 * Home — the workspace hub (SPEC §11.1, RUBRIC M1). Regions:
 *   active-initiatives · unassigned-inbox · recent-conversations · drill-cta.
 * Fetches the documented API routes; degrades to empty states if a route is
 * not yet wired, but always renders the structural regions.
 */
export function DiscoveryHome({ session }: { session: Session }) {
  const [initiatives, setInitiatives] = useState<InitiativeView[]>([]);
  const [recent, setRecent] = useState<ConversationListItem[]>([]);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    getJson<{ initiatives?: InitiativeView[] }>("/api/initiatives").then((d) => {
      if (d?.initiatives) setInitiatives(d.initiatives);
    });
    getJson<{ conversations?: ConversationListItem[] }>("/api/conversations").then((d) => {
      if (d?.conversations) setRecent(d.conversations.slice(0, 5));
    });
    getJson<{ conversations?: ConversationListItem[]; count?: number }>(
      "/api/conversations?inbox=1",
    ).then((d) => {
      if (typeof d?.count === "number") setInboxCount(d.count);
      else if (d?.conversations) setInboxCount(d.conversations.length);
    });
  }, []);

  const active = initiatives.filter((i) => i.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Glyph>◎</Glyph>
          <h1 className="text-2xl font-semibold text-[var(--bone)]">Discovery Workspace</h1>
        </div>
        <p className="text-sm text-[var(--bone-dim)]">
          Welcome, {session.displayName}.{" "}
          {!session.isAuthenticated && <Badge variant="neutral">seeded team</Badge>}
        </p>
      </header>

      {/* Unassigned inbox callout */}
      <section data-region="unassigned-inbox">
        <Link href="/conversations?inbox=1">
          <Card accent="attention">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--attention)] bg-[var(--panel-2)]">
                <Glyph tone="attention">⌅</Glyph>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--bone)]">Unassigned inbox</p>
                <p className="font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">
                  {inboxCount === null
                    ? "Conversations awaiting an initiative"
                    : `${inboxCount} conversation${inboxCount === 1 ? "" : "s"} awaiting an initiative`}
                </p>
              </div>
              <Glyph tone="muted">→</Glyph>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Active initiatives */}
      <section data-region="active-initiatives" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <Eyebrow as="h2">
            Active initiatives
          </Eyebrow>
          <Link href="/initiatives" className="font-[var(--font-mono)] text-xs text-[var(--signal)] hover:underline">
            View all
          </Link>
        </div>
        {active.length === 0 ? (
          <Card data-empty-state="active-initiatives">
            <CardContent className="flex flex-col items-start gap-2 pt-4">
              <p className="text-sm font-medium text-neutral-200">No active initiatives yet</p>
              <p className="text-xs text-[var(--bone-dim)]">
                Initiatives organize your discovery work. Create one to start
                building a prospect list and linking calls.
              </p>
              <Link href="/initiatives" className="mt-1">
                <Button size="sm" variant="secondary">
                  <Glyph>+</Glyph> New initiative
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {active.map((i) => (
              <Link key={i.id} href={`/initiatives/${i.id}`}>
                <Card accent="signal" className="h-full">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--bone)]">{i.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--bone-dim)]">
                        <Badge variant="neutral" className="capitalize">
                          {statusLabel(i.type)}
                        </Badge>
                      </p>
                    </div>
                    <Glyph tone="muted">→</Glyph>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent conversations */}
      <section data-region="recent-conversations" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <Eyebrow as="h2">
            Recent conversations
          </Eyebrow>
          <Link href="/conversations" className="font-[var(--font-mono)] text-xs text-[var(--signal)] hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card data-empty-state="recent-conversations">
            <CardContent className="flex flex-col items-start gap-2 pt-4">
              <p className="text-sm font-medium text-neutral-200">No conversations yet</p>
              <p className="text-xs text-[var(--bone-dim)]">
                Calls you ingest or paste land here. Add a transcript to start
                the discovery loop - score, drill the gap, re-score.
              </p>
              <Link href="/conversations/new" className="mt-1">
                <Button size="sm" variant="secondary">
                  <Glyph>+</Glyph> Paste a transcript
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((c) => (
              <Link key={c.id} href={`/conversations/${c.id}`}>
                <Card accent="signal">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--signal-deep)] bg-[var(--void)]">
                      <Glyph>❝</Glyph>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--bone)]">{c.title}</p>
                      <p className="font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">
                        <span className="capitalize">{c.source}</span>
                        {c.occurredAt ? ` / ${fmtDate(c.occurredAt)}` : ""}
                      </p>
                    </div>
                    <Glyph tone="muted">→</Glyph>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Drill your weakest skill — coaching add-on CTA (H7) */}
      <section data-region="drill-cta">
        <Link href="/team">
          <Card accent="positive">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--positive)] bg-[var(--panel-2)]">
                <Glyph tone="positive">▰</Glyph>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--bone)]">
                  Drill your weakest skill
                </p>
                <p className="font-[var(--font-serif)] text-sm italic text-[var(--bone-dim)]">
                  Coaching add-on - run the playbook check, then drill the gap.
                </p>
              </div>
              <Glyph tone="muted">→</Glyph>
            </CardContent>
          </Card>
        </Link>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessagesSquare, Inbox, Plus, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getJson, fmtDate, type ConversationListItem } from "@/lib/discovery-api";

// Params that mark the Unassigned-inbox view — mirrors lib/nav/active.mjs and
// the conversations API, which treat both `inbox` and `unassigned` as the
// inbox filter.
const INBOX_PARAMS = ["inbox", "unassigned"];

export function ConversationsList() {
  const params = useSearchParams();
  const inbox = INBOX_PARAMS.some((p) => params.has(p));
  const [items, setItems] = useState<ConversationListItem[]>([]);

  useEffect(() => {
    const url = inbox ? "/api/conversations?inbox=1" : "/api/conversations";
    getJson<{ conversations?: ConversationListItem[] }>(url).then((d) => {
      if (d?.conversations) setItems(d.conversations);
      else setItems([]);
    });
  }, [inbox]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {inbox ? (
            <Inbox className="h-5 w-5 text-amber-400" />
          ) : (
            <MessagesSquare className="h-5 w-5 text-sky-400" />
          )}
          <h1 className="text-2xl font-bold">{inbox ? "Unassigned inbox" : "Conversations"}</h1>
        </div>
        <Link href="/conversations/new">
          <Button size="sm">
            <Plus className="h-4 w-4" /> New
          </Button>
        </Link>
      </div>

      {!inbox && (
        <Link href="/conversations?inbox=1" className="block">
          <Card className="border-amber-500/30 bg-amber-500/5 transition-colors hover:border-amber-500/50">
            <CardContent className="flex items-center gap-3 pt-4">
              <Inbox className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="flex-1 text-sm text-neutral-200">View unassigned inbox</span>
              <ChevronRight className="h-5 w-5 text-neutral-600" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* The inbox view exposes the region marker so it is reachable (M1/F7). */}
      <section data-region="unassigned-inbox" className="flex flex-col gap-2">
        {inbox && (
          <p className="px-1 text-xs text-neutral-500">
            Ingested conversations awaiting an initiative — open one to link it.
          </p>
        )}
        {items.length === 0 ? (
          inbox ? (
            <Card data-empty-state="unassigned-inbox">
              <CardContent className="flex flex-col items-start gap-2 pt-4">
                <p className="text-sm font-medium text-neutral-200">Inbox is empty</p>
                <p className="text-xs text-neutral-500">
                  Every conversation has been linked to an initiative. New
                  ingested calls land here until you assign them.
                </p>
                <Link href="/conversations" className="mt-1">
                  <Button size="sm" variant="secondary">
                    View all conversations
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card data-empty-state="conversations">
              <CardContent className="flex flex-col items-start gap-2 pt-4">
                <p className="text-sm font-medium text-neutral-200">No conversations yet</p>
                <p className="text-xs text-neutral-500">
                  Conversations are ingested calls and pasted transcripts. Add
                  one to start scoring discovery and building profiles.
                </p>
                <Link href="/conversations/new" className="mt-1">
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" /> New conversation
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((c) => (
              <Link key={c.id} href={`/conversations/${c.id}`}>
                <Card className="transition-colors hover:border-neutral-700">
                  <CardContent className="flex items-center gap-3 pt-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                      <MessagesSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-100">{c.title}</p>
                      <p className="text-xs text-neutral-500">
                        <span className="capitalize">{c.source}</span>
                        {c.occurredAt ? ` · ${fmtDate(c.occurredAt)}` : ""}
                      </p>
                    </div>
                    {(!c.initiativeIds || c.initiativeIds.length === 0) && (
                      <Badge variant="needs_work" className="shrink-0 text-[10px]">
                        unassigned
                      </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 shrink-0 text-neutral-600" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

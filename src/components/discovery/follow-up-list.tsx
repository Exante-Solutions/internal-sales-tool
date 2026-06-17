"use client";

/**
 * Follow-up lifecycle list (SPEC §18.6, RUBRIC T). Renders each follow-up with
 * its visible state (open / done / archived) and the lifecycle controls:
 *   - mark complete  (region `followup-complete`)  → PATCH { status:'done' }
 *   - archive        (region `followup-archive`)   → PATCH { archive:true }
 * Unarchive/reopen are offered for archived/done items so the flow is reversible.
 *
 * Backed by PATCH /api/conversations/[conversationId]/follow-ups. Presentation
 * only — no domain rules; it reports back via `onChange` so the owner reloads.
 */

import { useState } from "react";
import { Check, Archive, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendJson, followUpState, type FollowUpView } from "@/lib/discovery-api";

const STATE_DOT: Record<"open" | "done" | "archived", string> = {
  open: "bg-amber-400",
  done: "bg-emerald-400",
  archived: "bg-neutral-600",
};
const STATE_BADGE: Record<"open" | "done" | "archived", "needs_work" | "strong" | "neutral"> = {
  open: "needs_work",
  done: "strong",
  archived: "neutral",
};

export function FollowUpList({
  conversationId,
  followUps,
  onChange,
}: {
  conversationId: string;
  followUps: FollowUpView[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(followUpId: string, body: { status?: "open" | "done"; archive?: boolean }) {
    setBusyId(followUpId);
    await sendJson(`/api/conversations/${conversationId}/follow-ups`, "PATCH", { followUpId, ...body });
    setBusyId(null);
    onChange();
  }

  if (followUps.length === 0) {
    return (
      <Card>
        <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
          No follow-ups yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-neutral-800">
        {followUps.map((f) => {
          const state = followUpState(f);
          const busy = busyId === f.id;
          return (
            <li key={f.id} className="flex items-center gap-3 p-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATE_DOT[state])} />
              <span
                className={cn(
                  "flex-1 text-sm",
                  state === "archived" ? "text-neutral-500 line-through" : "text-neutral-200",
                )}
              >
                {f.text}
              </span>
              <Badge variant={STATE_BADGE[state]} className="shrink-0 text-[10px] capitalize">
                {state}
              </Badge>
              <div className="flex shrink-0 gap-1">
                {state !== "done" && state !== "archived" && (
                  <Button
                    data-region="followup-complete"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => patch(f.id, { status: "done" })}
                    title="Mark complete"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {state === "done" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => patch(f.id, { status: "open" })}
                    title="Reopen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                {state !== "archived" ? (
                  <Button
                    data-region="followup-archive"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => patch(f.id, { archive: true })}
                    title="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => patch(f.id, { archive: false })}
                    title="Unarchive"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, MessagesSquare, ListChecks, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBack } from "@/components/discovery/page-back";
import { PeoplePicker } from "@/components/discovery/people-picker";
import {
  getJson,
  sendJson,
  statusLabel,
  fmtDate,
  followUpState,
  TARGET_STATUSES,
  type InitiativeView,
  type TargetView,
  type PeopleViewRow,
  type ConversationListItem,
  type FollowUpView,
} from "@/lib/discovery-api";

interface DetailResponse {
  initiative?: InitiativeView;
  targets?: TargetView[];
  peopleView?: PeopleViewRow[];
  conversations?: ConversationListItem[];
  followUps?: FollowUpView[];
}

export function InitiativeDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse>({});
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hard delete + confirm (B6, locked): linked conversations are preserved,
  // only unlinked. On success, return to the list.
  async function deleteInitiative() {
    if (!window.confirm("Delete this initiative? Its targets and conversation links are removed. Linked conversations are kept.")) {
      return;
    }
    setDeleting(true);
    const r = await sendJson(`/api/initiatives/${id}`, "DELETE");
    setDeleting(false);
    if (r !== null) router.push("/initiatives");
  }

  async function load() {
    const d = await getJson<DetailResponse>(`/api/initiatives/${id}`);
    if (d) setData(d);
    const t = await getJson<{ targets?: TargetView[] }>(`/api/initiatives/${id}/targets`);
    if (t?.targets) setData((prev) => ({ ...prev, targets: t.targets }));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Add an existing person (people-picker, S3) to the prospect list.
  async function addExisting(personId: string) {
    setBusy(true);
    const r = await sendJson(`/api/initiatives/${id}/targets`, "POST", {
      personId,
      status: "to_contact",
    });
    setBusy(false);
    if (r) {
      setAdding(false);
      load();
    }
  }

  // Create a new person inline and target them in one call.
  async function addNew(displayName: string, email?: string) {
    setBusy(true);
    const body: Record<string, unknown> = { displayName, status: "to_contact" };
    // The route requires displayName + email to create a person inline; when no
    // email is supplied, synthesize a placeholder so the prospect can be added.
    body.email = email ?? `${displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.invalid`;
    const r = await sendJson(`/api/initiatives/${id}/targets`, "POST", body);
    setBusy(false);
    if (r) {
      setAdding(false);
      load();
    }
  }

  async function advance(personId: string, status: string) {
    await sendJson(`/api/initiatives/${id}/targets/${personId}`, "PATCH", { status });
    load();
  }

  const init = data.initiative;
  const targets = data.targets ?? [];
  const people = data.peopleView ?? [];
  const conversations = data.conversations ?? [];
  const followUps = data.followUps ?? [];

  // Build a personId → display-name index from every shape the response carries
  // (targets + people-view) so a row missing its name in one source can reuse
  // the other. Never surface a raw UUID (B7).
  const nameById = new Map<string, string>();
  for (const t of targets) if (t.personName) nameById.set(t.personId, t.personName);
  for (const p of people) if (p.personName) nameById.set(p.personId, p.personName);
  const displayName = (personId: string, personName?: string) =>
    personName ?? nameById.get(personId) ?? "Unnamed person";

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/initiatives" label="Initiatives" />

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{init?.name ?? "Initiative"}</h1>
          <div data-region="delete-initiative">
            <Button
              size="sm"
              variant="ghost"
              disabled={deleting}
              onClick={deleteInitiative}
              className="text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
        {init && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="capitalize">{statusLabel(init.type)}</Badge>
            <Badge variant={init.status === "active" ? "strong" : "neutral"} className="capitalize">
              {statusLabel(init.status)}
            </Badge>
          </div>
        )}
        {init?.goalMd && <p className="text-sm leading-relaxed text-neutral-400">{init.goalMd}</p>}
        {init?.hypothesisMd && (
          <p className="text-xs leading-relaxed text-neutral-500">
            <span className="font-semibold uppercase tracking-wide">Hypothesis:</span> {init.hypothesisMd}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Prospect list — explicit targets, no conversation required (E3/E7) */}
        <section data-region="prospect-list" className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <ListChecks className="h-3.5 w-3.5" /> Prospect list
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {adding && (
            <PeoplePicker
              busy={busy}
              onSelectExisting={(personId) => addExisting(personId)}
              onCreateNew={(displayName, email) => addNew(displayName, email)}
            />
          )}

          {targets.length === 0 ? (
            <Card>
              <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
                No prospects yet. Add people to reach — no call or email required.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-neutral-800">
                {targets.map((t) => (
                  <li key={t.personId} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/people/${t.personId}`}
                        className="block truncate text-sm font-medium text-neutral-100 hover:underline"
                      >
                        {displayName(t.personId, t.personName)}
                      </Link>
                      {t.reasonMd && (
                        <p className="truncate text-xs text-neutral-500">{t.reasonMd}</p>
                      )}
                    </div>
                    <select
                      value={t.status}
                      onChange={(e) => advance(t.personId, e.target.value)}
                      className="h-9 shrink-0 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-xs capitalize text-neutral-200 outline-none focus:border-neutral-500"
                    >
                      {TARGET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* People view — targets ∪ engaged, each flagged (E5) */}
        <section data-region="people-view" className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            People (targets ∪ engaged)
          </h2>
          {people.length === 0 ? (
            <Card>
              <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
                No one engaged or targeted yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-neutral-800">
                {people.map((p) => (
                  <li key={p.personId} className="flex items-center gap-2 p-3">
                    <Link
                      href={`/people/${p.personId}`}
                      className="min-w-0 flex-1 truncate text-sm text-neutral-100 hover:underline"
                    >
                      {displayName(p.personId, p.personName)}
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      {p.targeted && (
                        <Badge variant="neutral" className="text-[10px]">targeted</Badge>
                      )}
                      {p.engaged && (
                        <Badge variant="strong" className="text-[10px]">engaged</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      {/* Linked conversations (E1/E2) */}
      <section data-region="linked-conversations" className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Linked conversations
        </h2>
        {conversations.length === 0 ? (
          <Card>
            <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
              No conversations linked yet. Link one from the Unassigned inbox.
            </CardContent>
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
                        <span className="capitalize">{c.source}</span>
                        {c.occurredAt ? ` · ${fmtDate(c.occurredAt)}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Follow-ups (G4) */}
      <section data-region="follow-ups" className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Follow-ups
        </h2>
        {followUps.length === 0 ? (
          <Card>
            <CardContent data-empty-state className="pt-4 text-sm text-neutral-400">
              No open follow-ups.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-neutral-800">
              {followUps.map((f) => {
                const state = followUpState(f);
                return (
                  <li key={f.id} className="flex items-center gap-3 p-3">
                    <span
                      className={
                        state === "done"
                          ? "h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400"
                          : state === "archived"
                            ? "h-2.5 w-2.5 shrink-0 rounded-full bg-neutral-600"
                            : "h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
                      }
                    />
                    <span className="flex-1 text-sm text-neutral-200">{f.text}</span>
                    <Badge
                      variant={state === "done" ? "strong" : state === "archived" ? "neutral" : "needs_work"}
                      className="text-[10px] capitalize"
                    >
                      {state}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

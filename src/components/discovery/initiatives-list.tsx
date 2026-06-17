"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getJson,
  sendJson,
  statusLabel,
  INITIATIVE_TYPES,
  type InitiativeView,
} from "@/lib/discovery-api";

function statusVariant(s: string): "strong" | "needs_work" | "neutral" {
  if (s === "active") return "strong";
  if (s === "paused") return "needs_work";
  return "neutral";
}

export function InitiativesList() {
  const [items, setItems] = useState<InitiativeView[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("market");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await getJson<{ initiatives?: InitiativeView[] }>("/api/initiatives");
    if (d?.initiatives) setItems(d.initiatives);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const created = await sendJson<{ initiative?: InitiativeView }>("/api/initiatives", "POST", {
      name: name.trim(),
      type,
      goalMd: goal,
      hypothesisMd: "",
    });
    setBusy(false);
    if (created) {
      setName("");
      setGoal("");
      setCreating(false);
      load();
    }
  }

  // Hard delete + confirm (B6, locked). Per-row; stop the row's Link nav.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function remove(initiativeId: string, initiativeName: string) {
    if (!window.confirm(`Delete "${initiativeName}"? Its targets and conversation links are removed. Linked conversations are kept.`)) {
      return;
    }
    setDeletingId(initiativeId);
    const r = await sendJson(`/api/initiatives/${initiativeId}`, "DELETE");
    setDeletingId(null);
    if (r !== null) load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          <h1 className="text-2xl font-bold">Initiatives</h1>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Initiative name"
              className="h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm capitalize text-neutral-100 outline-none focus:border-neutral-500"
            >
              {INITIATIVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {statusLabel(t)}
                </option>
              ))}
            </select>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal / hypothesis"
              rows={3}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={busy || !name.trim()}>
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card data-empty-state="initiatives">
          <CardContent className="flex flex-col items-start gap-2 pt-4">
            <p className="text-sm font-medium text-neutral-200">No initiatives yet</p>
            <p className="text-xs text-neutral-500">
              An initiative is a market, account, or motion you&apos;re running
              discovery against. Create one to build its prospect list and link
              conversations.
            </p>
            <Button size="sm" variant="secondary" className="mt-1" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New initiative
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <div key={i.id} className="relative">
              <Link href={`/initiatives/${i.id}`}>
                <Card className="h-full transition-colors hover:border-neutral-700">
                  <CardContent className="flex flex-col gap-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-100">{i.name}</p>
                      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-600" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="capitalize">
                        {statusLabel(i.type)}
                      </Badge>
                      <Badge variant={statusVariant(i.status)} className="capitalize">
                        {statusLabel(i.status)}
                      </Badge>
                    </div>
                    {i.goalMd && (
                      <p className="line-clamp-2 text-xs text-neutral-500">{i.goalMd}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
              <div data-region="delete-initiative" className="absolute bottom-2 right-2">
                <button
                  type="button"
                  aria-label={`Delete ${i.name}`}
                  disabled={deletingId === i.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(i.id, i.name);
                  }}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

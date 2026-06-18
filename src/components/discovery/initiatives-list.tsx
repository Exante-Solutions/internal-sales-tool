"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Glyph } from "@/components/ui/glyph";
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
          <Glyph>◎</Glyph>
          <h1 className="text-2xl font-semibold text-[var(--bone)]">Initiatives</h1>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Glyph>+</Glyph> New
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <Field
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Initiative name"
            />
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {INITIATIVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {statusLabel(t)}
                </option>
              ))}
            </Select>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal / hypothesis"
              rows={3}
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
            <p className="text-sm font-medium text-[var(--bone)]">No initiatives yet</p>
            <p className="text-xs text-[var(--bone-dim)]">
              An initiative is a market, account, or motion you&apos;re running
              discovery against. Create one to build its prospect list and link
              conversations.
            </p>
            <Button size="sm" variant="secondary" className="mt-1" onClick={() => setCreating(true)}>
              <Glyph>+</Glyph> New initiative
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <div key={i.id} className="relative">
              <Link href={`/initiatives/${i.id}`}>
                <Card accent={i.status === "active" ? "signal" : "neutral"} className="h-full">
                  <CardContent className="flex flex-col gap-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--bone)]">{i.name}</p>
                      <Glyph tone="muted">→</Glyph>
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
                      <p className="line-clamp-2 font-[var(--font-serif)] text-sm leading-relaxed text-[var(--bone-dim)]">{i.goalMd}</p>
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
                  className="rounded-[var(--radius)] p-1.5 text-[var(--bone-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--attention)] disabled:opacity-50"
                >
                  <Glyph tone="attention">×</Glyph>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

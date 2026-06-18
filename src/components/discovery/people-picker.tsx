"use client";

/**
 * People picker (SPEC §18.5, RUBRIC S3). Search people already in the DB and
 * SELECT one (returns an existing `personId`), or fall through to creating a
 * new person inline. Used by the initiative prospect-list add-flow; the caller
 * POSTs the chosen `personId` (or new displayName+email) to
 * /api/initiatives/[id]/targets.
 *
 * Presentation only: debounced GET /api/people?q=… for the candidate set; the
 * dedupe/identity rules live at the route edge (§4.3).
 */

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Glyph } from "@/components/ui/glyph";
import { getJson, type PersonListItem } from "@/lib/discovery-api";

export function PeoplePicker({
  onSelectExisting,
  onCreateNew,
  busy,
}: {
  /** Chose an existing person from the DB. */
  onSelectExisting: (personId: string, name: string) => void;
  /** Chose to create a new person inline. */
  onCreateNew: (displayName: string, email?: string) => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-query token: only the latest query's response may render. A slower
  // earlier request resolving after a newer one must not overwrite the newer
  // results (3425264002).
  const queryToken = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 1) {
      // Invalidate any in-flight request so its late response is ignored.
      queryToken.current += 1;
      setResults([]);
      return;
    }
    const token = ++queryToken.current;
    timer.current = setTimeout(async () => {
      setSearching(true);
      const d = await getJson<{ people?: PersonListItem[] }>(`/api/people?q=${encodeURIComponent(q)}`);
      // Ignore this response if a newer query has since been issued.
      if (queryToken.current !== token) return;
      setSearching(false);
      setResults(d?.people ?? []);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const trimmed = query.trim();
  const exactMatch = results.some(
    (p) => p.primaryDisplayName.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <Card data-region="people-picker">
      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="relative">
          <Glyph tone="muted" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            ⌖
          </Glyph>
          <Field
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, or type a new name…"
            className="pl-9"
            autoFocus
          />
        </div>

        {searching && <p className="px-1 font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">Searching…</p>}

        {results.length > 0 && (
          <ul className="divide-y divide-[var(--grid)] rounded-[var(--radius)] border border-[var(--grid)]">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectExisting(p.id, p.primaryDisplayName)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-[var(--panel-2)] disabled:opacity-50"
                >
                  <Glyph tone="positive">✓</Glyph>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--bone)]">
                      {p.primaryDisplayName}
                    </span>
                    {p.emails?.[0] && (
                      <span className="block truncate font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">
                        {p.emails[0].emailNormalized}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Create-new fall-through when there's no exact existing match. */}
        {trimmed.length > 0 && !exactMatch && (
          <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-dashed border-[var(--grid)] p-3">
            <p className="flex items-center gap-1.5 text-xs text-[var(--bone-dim)]">
              <Glyph>+</Glyph> Create a new person
            </p>
            <Field
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onCreateNew(trimmed, newEmail.trim() || undefined)}
            >
              Add “{trimmed}” as new
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

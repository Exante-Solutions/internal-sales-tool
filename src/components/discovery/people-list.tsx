"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Glyph } from "@/components/ui/glyph";
import { getJson, type PersonListItem } from "@/lib/discovery-api";

export function PeopleList() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonListItem[]>([]);

  useEffect(() => {
    const url = query.trim()
      ? `/api/people?q=${encodeURIComponent(query.trim())}`
      : "/api/people";
    // Drop a slow older-query response so it can't replace a newer query's
    // results: the debounce timer clears on cleanup, but an in-flight fetch
    // does not — guard it with a per-effect active flag (3425215488).
    let active = true;
    const t = setTimeout(() => {
      getJson<{ people?: PersonListItem[] }>(url).then((d) => {
        if (active) setPeople(d?.people ?? []);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Glyph>◔</Glyph>
          <h1 className="text-2xl font-semibold text-[var(--bone)]">People</h1>
        </div>
        <Link href="/people/new" data-region="add-person">
          <Button size="sm">
            <Glyph>+</Glyph> Add person
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Glyph tone="muted" className="absolute left-3 top-1/2 -translate-y-1/2">
          ⌖
        </Glyph>
        <Field
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or company"
          className="pl-9"
        />
      </div>

      {people.length === 0 ? (
        query ? (
          <Card data-empty-state="people-search">
            <CardContent className="flex flex-col items-start gap-2 pt-4">
              <p className="text-sm font-medium text-[var(--bone)]">No people match that search</p>
              <p className="text-xs text-[var(--bone-dim)]">
                Nothing matched &ldquo;{query}&rdquo; by name, email, or company.
                Try a different term or clear the search.
              </p>
              <Button size="sm" variant="secondary" className="mt-1" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card data-empty-state="people">
            <CardContent className="flex flex-col items-start gap-2 pt-4">
              <p className="text-sm font-medium text-[var(--bone)]">No people yet</p>
              <p className="text-xs text-[var(--bone-dim)]">
                People are created from call participants and synced emails, or
                added by hand. Add one to start a profile and timeline.
              </p>
              <Link href="/people/new" className="mt-1">
                <Button size="sm" variant="secondary">
                  <Glyph>+</Glyph> Add a person
                </Button>
              </Link>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {people.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`}>
              <Card accent="signal" className="h-full">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--bone)]">
                      {p.primaryDisplayName}
                    </p>
                    <p className="truncate font-[var(--font-mono)] text-xs text-[var(--bone-dim)]">
                      {p.emails?.[0]?.emailNormalized ?? ""}
                      {p.currentCompany ? ` · ${p.currentCompany}` : ""}
                    </p>
                  </div>
                  {p.emails && p.emails.length > 1 && (
                    <Badge variant="neutral" className="shrink-0 text-[10px]">
                      {p.emails.length} emails
                    </Badge>
                  )}
                  <Glyph tone="muted">→</Glyph>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

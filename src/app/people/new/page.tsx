"use client";

/**
 * Add people (SPEC §18.5, RUBRIC S1/S2). Two surfaces on one screen:
 *   - Web form (region `person-form`)         → POST /api/people  (name + email
 *     + optional company; the route dedupes by email at the edge).
 *   - CSV bulk import (region `people-csv-import`) → POST /api/people/import
 *     (parsed by the pure lib/people/csv.mjs; reports created/updated/skipped).
 *
 * Thin client: validation + dedupe + identity resolution all live at the route
 * edge; this only collects input and renders the result.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBack } from "@/components/discovery/page-back";
import { sendJson } from "@/lib/discovery-api";

const inputCls =
  "h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

export default function NewPersonPage() {
  const router = useRouter();

  // ── Web form ───────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setFormError("");
    const r = await sendJson<{ person?: { id: string }; created?: boolean }>(
      "/api/people",
      "POST",
      { displayName: name.trim(), email: email.trim(), company: company.trim() || undefined },
    );
    setSaving(false);
    if (r?.person?.id) {
      router.push(`/people/${r.person.id}`);
    } else {
      setFormError("Could not add this person. Check the name and email.");
    }
  }

  // ── CSV bulk import ─────────────────────────────────────────────────────────
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState("");

  async function readFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function runImport() {
    if (!csv.trim()) return;
    setImporting(true);
    setImportError("");
    setSummary(null);
    const r = await sendJson<{ summary?: ImportSummary }>("/api/people/import", "POST", {
      csv,
    });
    setImporting(false);
    if (r?.summary) setSummary(r.summary);
    else setImportError("Import failed. Check the CSV format.");
  }

  return (
    <div className="flex flex-col gap-5">
      <PageBack href="/people" label="People" />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Add people</h1>
        <p className="text-sm text-neutral-400">
          Add one person, or import many from a CSV. Duplicates are merged by email.
        </p>
      </header>

      {/* Single-person web form (S1) */}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <UserPlus className="h-3.5 w-3.5" /> One person
        </h2>
        <Card>
          <CardContent className="pt-4">
            <form data-region="person-form" onSubmit={submitForm} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="person-name">Name</label>
                <input
                  id="person-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Prospect"
                  className={inputCls}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="person-email">Email</label>
                <input
                  id="person-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@acme.com"
                  className={inputCls}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="person-company">Company (optional)</label>
                <input
                  id="person-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                  className={inputCls}
                />
              </div>
              {formError && <p className="text-sm text-rose-400">{formError}</p>}
              <Button type="submit" disabled={saving || !name.trim() || !email.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add person"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* CSV bulk import (S2) */}
      <section data-region="people-csv-import" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Upload className="h-3.5 w-3.5" /> Import from CSV
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <p className="text-xs leading-relaxed text-neutral-500">
              Columns: <code className="text-neutral-300">name</code>,{" "}
              <code className="text-neutral-300">email</code> (multiple allowed),{" "}
              <code className="text-neutral-300">company</code>. Header order is flexible. Rows whose
              email already exists are updated, not duplicated.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
              className="text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
            />
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"name,email,company\nJane Prospect,jane@acme.com,Acme Inc."}
              rows={6}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-100 outline-none focus:border-neutral-500"
            />
            {importError && <p className="text-sm text-rose-400">{importError}</p>}
            {summary && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <Badge variant="strong">{summary.created} created</Badge>
                <Badge variant="neutral">{summary.updated} updated</Badge>
                <Badge variant="neutral">{summary.skipped} skipped</Badge>
                <span className="text-neutral-500">of {summary.total} rows</span>
              </div>
            )}
            <Button variant="secondary" onClick={runImport} disabled={importing || !csv.trim()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import people"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

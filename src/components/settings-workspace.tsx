"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Workspace rename control (SPEC §9, §18.2; RUBRIC Q6, region `settings-workspace`).
 * The workspace name is APP-MANAGED: this form PATCHes /api/settings/workspace and
 * reflects the saved name. Prefilled with the current name; Save is disabled while
 * unchanged or empty.
 */
export function SettingsWorkspace({ name: initialName }: { name: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== saved;

  async function save() {
    if (!dirty) return;
    setBusy(true);
    setError(null);
    setJustSaved(false);
    try {
      const r = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) {
        setError("Could not save the workspace name. Try again.");
        return;
      }
      const data = (await r.json()) as { name?: string };
      const next = data.name ?? trimmed;
      setName(next);
      setSaved(next);
      setJustSaved(true);
      router.refresh();
    } catch {
      setError("Could not save the workspace name. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="workspace-name-input" className="text-sm text-neutral-400">
        Workspace name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="workspace-name-input"
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            setJustSaved(false);
          }}
          placeholder="Discovery Workspace"
          className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
        />
        <Button size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
        {justSaved && !dirty && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

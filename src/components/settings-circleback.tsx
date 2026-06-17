"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Local PUT/DELETE helper (the shared sendJson omits PUT). Returns parsed JSON
 * or null on any non-OK/network error so the UI degrades instead of throwing. */
async function callJson(
  url: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

/**
 * Circleback integration control (SPEC §18.1, region `settings-circleback`).
 * Lets the signed-in user save THEIR OWN Circleback secret (PUT) or clear it
 * (DELETE). The stored secret is never sent back to the client, so connected
 * state is just a boolean; the input is always blank on load. Editing while
 * connected replaces the secret.
 */
export function SettingsCircleback({ connected: initialConnected }: { connected: boolean }) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [secret, setSecret] = useState("");
  const [editing, setEditing] = useState(!initialConnected);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!secret.trim()) {
      setError("Enter your Circleback secret.");
      return;
    }
    setBusy("save");
    setError(null);
    const res = await callJson(
      "/api/settings/integrations/circleback",
      "PUT",
      { secret: secret.trim() },
    );
    setBusy(null);
    if (!res) {
      setError("Could not save the secret. Try again.");
      return;
    }
    setSecret("");
    setConnected(true);
    setEditing(false);
    router.refresh();
  }

  async function clear() {
    setBusy("clear");
    setError(null);
    const res = await callJson("/api/settings/integrations/circleback", "DELETE");
    setBusy(null);
    if (!res) {
      setError("Could not clear the secret. Try again.");
      return;
    }
    setSecret("");
    setConnected(false);
    setEditing(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {connected ? (
          <Badge variant="neutral" className="gap-1 text-emerald-400">
            <Check className="h-3 w-3" /> Connected
          </Badge>
        ) : (
          <Badge variant="neutral">Not connected</Badge>
        )}
      </div>

      {connected && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-neutral-400">
            Your Circleback secret is stored securely. It is never shown again.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditing(true);
              setError(null);
            }}
          >
            Replace secret
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={busy !== null}>
            {busy === "clear" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="circleback-secret" className="text-sm text-neutral-400">
            Your Circleback secret
          </label>
          <input
            id="circleback-secret"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="sk_live_…"
            className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save secret
            </Button>
            {connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setSecret("");
                  setError(null);
                }}
                disabled={busy !== null}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

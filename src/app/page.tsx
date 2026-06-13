"use client";

import { useState } from "react";

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [coaching, setCoaching] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setCoaching("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setCoaching(data.coaching);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold">CoachLoop</h1>
        <p className="text-neutral-400">
          Paste a sales-call transcript. Get coaching back.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste call transcript…"
          rows={10}
          className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={loading || !transcript.trim()}
          className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-40"
        >
          {loading ? "Coaching…" : "Get coaching"}
        </button>
      </form>

      {error && <p className="text-red-400">{error}</p>}

      {coaching && (
        <section className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          {coaching}
        </section>
      )}
    </main>
  );
}

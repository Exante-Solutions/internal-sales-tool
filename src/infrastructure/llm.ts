/**
 * Thin Opus-4.8 JSON helper. Lives in infrastructure because it touches the SDK.
 * Forces a strict-JSON reply and parses it; throws on unparseable output so the
 * caller's re-prompt loop can react. Vendor objects (Anthropic Message) die here.
 */

import { getAnthropic } from "@/lib/anthropic";
import { MODEL } from "@/config";

export async function callJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  // Note: Opus 4.8 deprecates `temperature`; the model manages its own sampling.
  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [
      {
        role: "user",
        content: `${opts.user}\n\nRespond with ONLY a single valid JSON object — no prose, no markdown fences.`,
      },
    ],
  });

  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  return parseJson<T>(text);
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Salvage the outermost JSON object if the model wrapped it in stray text.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error(`model did not return parseable JSON: ${trimmed.slice(0, 200)}`);
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/config";

/**
 * Server-only Anthropic client, lazily created. Do not import from client
 * components. Lazy so module import (e.g. during `next build`) never requires
 * the key — it still fails fast at first actual use via getAnthropicApiKey().
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: getAnthropicApiKey() });
  return client;
}

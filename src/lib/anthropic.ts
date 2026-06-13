import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/config";

/** Server-only Anthropic client. Do not import from client components. */
export const anthropic = new Anthropic({ apiKey: getAnthropicApiKey() });

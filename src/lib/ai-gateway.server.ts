import { createAnthropic } from "@ai-sdk/anthropic";

// Isaly AI-standard: text-generering går direkt mot Claude, inte via en
// tredjeparts-gateway. Haiku är default eftersom dessa anrop (studieplaner,
// övningar, rättning) tidigare kördes på Lovable AI Gateway's "flash"-nivå.
export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}

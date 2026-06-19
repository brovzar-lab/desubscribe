import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "./settings";

export async function getClient(): Promise<Anthropic | null> {
  const apiKey = await getAnthropicKey();
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export const EXTRACT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
// Deeper reasoning for "how do I cancel this merchant" research.
export const RESEARCH_MODEL = "claude-opus-4-8";

// Ask Claude for JSON and parse it defensively (strip code fences / prose).
export function parseJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const startArr = candidate.indexOf("[");
  const from =
    start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (from === -1) return null;
  try {
    return JSON.parse(candidate.slice(from)) as T;
  } catch {
    return null;
  }
}

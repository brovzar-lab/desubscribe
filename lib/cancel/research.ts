import { getClient, RESEARCH_MODEL, parseJson } from "../anthropic";
import { lookupPlaybook } from "./playbooks";

export interface CancelPlan {
  method: "web" | "email" | "phone" | "unknown";
  cancelUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  steps: string[];
  notes?: string;
  retentionTip?: string;
  source?: "playbook" | "ai" | "generic";
}

// Look up how to cancel a given service. Tries a curated playbook first, then
// Tavily web context distilled by Claude, then generic guidance.
export async function researchCancellation(serviceName: string): Promise<CancelPlan> {
  const playbook = lookupPlaybook(serviceName);
  if (playbook) return { ...playbook, source: "playbook" };

  const context = await tavilySearch(`how to cancel ${serviceName} subscription cancellation page`);
  const client = await getClient();
  if (!client) {
    return {
      method: context.url ? "web" : "unknown",
      cancelUrl: context.url,
      steps: context.url
        ? [`Open ${context.url}`, "Sign in", "Find Membership/Plan settings", "Cancel and confirm"]
        : [`Search "${serviceName} cancel subscription" and follow the official help page.`],
      notes: "No Claude key set — generic guidance.",
      source: "generic",
    };
  }

  const msg = await client.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 700,
    system: `You research how to cancel subscriptions. Given web context, output ONLY JSON:
{"method":"web|email|phone|unknown","cancelUrl":string|null,"email":string|null,"phone":string|null,"steps":[string],"notes":string}
Prefer the official cancellation URL. Steps must be concrete and ordered.`,
    messages: [
      {
        role: "user",
        content: `Service: ${serviceName}\n\nWeb context:\n${context.text || "(none)"}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const ai = parseJson<CancelPlan>(text);
  return ai
    ? { ...ai, source: "ai" }
    : { method: "unknown", steps: [`Could not determine steps for ${serviceName}.`], source: "generic" };
}

async function tavilySearch(query: string): Promise<{ text: string; url: string | null }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { text: "", url: null };
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        include_answer: true,
      }),
    });
    const data = (await res.json()) as {
      answer?: string;
      results?: { title: string; url: string; content: string }[];
    };
    const url = data.results?.[0]?.url ?? null;
    const text =
      (data.answer ? `Answer: ${data.answer}\n\n` : "") +
      (data.results ?? [])
        .map((r) => `- ${r.title} (${r.url})\n  ${r.content.slice(0, 300)}`)
        .join("\n");
    return { text, url };
  } catch {
    return { text: "", url: null };
  }
}

import { getClient, RESEARCH_MODEL, parseJson } from "./anthropic";
import { lookupPlaybook } from "./cancel/playbooks";

export interface RetentionDraft {
  strategy: "pause" | "downgrade" | "discount" | "cancel_threat";
  subject: string;
  body: string;
  rationale: string;
}

interface SubInfo {
  name: string;
  amount: number | null;
  currency: string;
  cycle: string;
  category: string;
}

// Draft a "keep my money" message before cancelling: pause, downgrade, or ask
// for a retention discount. Uses any known retention tip as a hint.
export async function draftRetention(sub: SubInfo): Promise<RetentionDraft> {
  const tip = lookupPlaybook(sub.name)?.retentionTip;
  const client = await getClient();
  const price = sub.amount != null ? `${sub.currency} ${sub.amount} / ${sub.cycle}` : "an unknown amount";

  if (!client) {
    return {
      strategy: "discount",
      subject: `Considering cancelling my ${sub.name} subscription`,
      body:
        `Hi,\n\nI've been a ${sub.name} subscriber paying ${price} and I'm reviewing my subscriptions. ` +
        `Before I cancel, is there a loyalty discount, a pause option, or a cheaper plan you can offer?\n\n` +
        `If not, please treat this as my cancellation request.\n\nThanks`,
      rationale: tip || "Generic retention ask (no Claude key set).",
    };
  }

  const msg = await client.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 700,
    system:
      `You write concise, polite, effective customer-retention messages that save the user money WITHOUT ` +
      `necessarily cancelling. Choose the best strategy (pause | downgrade | discount | cancel_threat). ` +
      `Return ONLY JSON: {"strategy":string,"subject":string,"body":string,"rationale":string}. ` +
      `Body should be a ready-to-send email/chat message, first person, no placeholders left blank.`,
    messages: [
      {
        role: "user",
        content: `Service: ${sub.name} (${sub.category}), paying ${price}.${tip ? ` Known tip: ${tip}` : ""}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return (
    parseJson<RetentionDraft>(text) ?? {
      strategy: "discount",
      subject: `Retention request — ${sub.name}`,
      body: `Hi, I'm reviewing my ${sub.name} subscription (${price}). Can you offer a discount, pause, or cheaper plan before I cancel?`,
      rationale: tip || "Fallback draft.",
    }
  );
}

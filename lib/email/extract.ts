import { getClient, EXTRACT_MODEL, parseJson } from "../anthropic";
import type { ExtractedSub } from "../types";

export interface RawEmail {
  from: string;
  subject: string;
  date: string; // ISO
  text: string; // plain-text body (truncated)
}

const SYSTEM = `You are a precise financial-document parser. Given a marketing or
billing email, decide whether it represents a PAID subscription / recurring charge
(receipt, invoice, renewal notice, trial-converting notice). Pure marketing with no
charge is NOT a subscription.

Return ONLY JSON:
{
  "isSubscription": boolean,
  "name": "Service name shown to the user (e.g. Netflix, NYTimes)",
  "merchant": "normalized billing entity if different",
  "category": "Streaming|Music|News|Software|Cloud|Fitness|Gaming|Shopping|Utilities|Finance|Education|Other",
  "amount": number|null,
  "currency": "ISO code, default USD",
  "cycle": "weekly|monthly|quarterly|yearly|unknown",
  "nextDueAt": "ISO date or null",
  "isTrial": boolean,
  "cancelUrl": "URL to manage/cancel if present, else null",
  "confidence": 0..1
}`;

// Extract a subscription from one email via Claude. Returns null if not a sub
// or if no API key is configured (caller falls back to heuristics).
export async function extractFromEmail(email: RawEmail): Promise<ExtractedSub | null> {
  const client = await getClient();
  if (!client) return heuristicExtract(email);

  const msg = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `FROM: ${email.from}\nSUBJECT: ${email.subject}\nDATE: ${email.date}\n\n${email.text.slice(0, 6000)}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = parseJson<ExtractedSub & { isSubscription: boolean }>(text);
  if (!parsed || !parsed.isSubscription) return null;
  return parsed;
}

const MONEY = /(?:USD|US\$|\$|€|£)\s?(\d+(?:[.,]\d{2})?)/i;
const CYCLE_WORDS: [RegExp, ExtractedSub["cycle"]][] = [
  [/year|annual|\/yr|per year/i, "yearly"],
  [/month|\/mo|per month/i, "monthly"],
  [/week/i, "weekly"],
  [/quarter/i, "quarterly"],
];

// No-API fallback: regex/keyword heuristics so the app still works offline.
export function heuristicExtract(email: RawEmail): ExtractedSub | null {
  const hay = `${email.subject}\n${email.text}`;
  const looksBilling =
    /(receipt|invoice|subscription|renew|your plan|payment|billed|trial)/i.test(hay);
  if (!looksBilling) return null;

  const amount = hay.match(MONEY);
  const cycle = CYCLE_WORDS.find(([re]) => re.test(hay))?.[1] ?? "unknown";
  const name = senderName(email.from);
  return {
    name,
    merchant: name,
    amount: amount ? Number(amount[1].replace(",", ".")) : undefined,
    currency: "USD",
    cycle,
    isTrial: /trial/i.test(hay),
    confidence: 0.45,
  };
}

function senderName(from: string): string {
  const named = from.match(/^"?([^"<]+?)"?\s*</);
  if (named) return named[1].trim();
  const domain = from.match(/@([^>\s]+)/)?.[1] ?? from;
  return domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
}

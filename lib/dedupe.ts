import type { ExtractedSub } from "./types";

// Normalize a merchant/name into a dedupe key: lowercase, strip punctuation,
// strip common payment-descriptor noise ("recurring", "sq *", trailing store #s).
export function merchantKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(recurring|payment|subscription|monthly|annual|autopay|bill)\b/g, " ")
    .replace(/\bsq ?\*|tst\*|paypal ?\*|pp\*|amzn mktp|amazon\.com\*?/g, " ")
    .replace(/#?\d{3,}/g, " ") // store / ref numbers
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3) // first few significant tokens
    .join(" ");
}

// Two subs are the "same service" if their merchant keys match, or one key
// contains the other (e.g. "netflix" vs "netflix com").
export function sameService(a: string, b: string): boolean {
  const ka = merchantKey(a);
  const kb = merchantKey(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

// Merge a list of extracted subs (from email + bank) into deduplicated services.
// Bank-sourced amounts/dates win for money fields (they're authoritative);
// email wins for cancel/unsubscribe info.
export function mergeSubs(
  items: (ExtractedSub & { source: string })[],
): (ExtractedSub & { source: string; sources: string[] })[] {
  const groups: (ExtractedSub & { source: string; sources: string[] })[] = [];

  for (const item of items) {
    const label = item.merchant || item.name;
    const match = groups.find((g) => sameService(g.merchant || g.name, label));
    if (!match) {
      groups.push({ ...item, sources: [item.source] });
      continue;
    }
    if (!match.sources.includes(item.source)) match.sources.push(item.source);
    // Prefer bank for monetary truth.
    const bankWins = item.source === "bank";
    if (bankWins || match.amount == null) {
      if (item.amount != null) match.amount = item.amount;
      if (item.cycle) match.cycle = item.cycle;
      if (item.nextDueAt) match.nextDueAt = item.nextDueAt;
    }
    // Email contributes cancel/unsub details.
    if (item.cancelUrl && !match.cancelUrl) match.cancelUrl = item.cancelUrl;
    if (item.isTrial) match.isTrial = true;
    match.confidence = Math.min(1, (match.confidence ?? 0.6) + 0.15); // corroborated
    if (match.sources.length > 1) match.source = "merged";
  }
  return groups;
}

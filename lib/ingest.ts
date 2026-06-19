import { prisma } from "./db";
import { extractFromEmail } from "./email/extract";
import { sameService } from "./dedupe";
import type { UnsubInfo } from "./types";

export interface IngestInput {
  from: string;
  subject: string;
  text: string;
  date?: string;
  unsub?: UnsubInfo;
}

// Extract a single receipt/billing email into a subscription, upserting against
// any existing match. Shared by the paste box and the inbound webhook.
export async function ingestEmail(input: IngestInput): Promise<{ ok: boolean; message: string; id?: string }> {
  if (!input.text && !input.subject) return { ok: false, message: "Empty email." };

  const sub = await extractFromEmail({
    from: input.from,
    subject: input.subject,
    date: input.date ?? new Date().toISOString(),
    text: input.text,
  });
  if (!sub) return { ok: false, message: "That didn't look like a subscription/receipt." };

  const unsub = input.unsub ?? { oneClick: false, httpsUrl: null, mailto: null };
  const data = {
    name: sub.name,
    merchant: sub.merchant ?? sub.name,
    category: sub.category ?? "Other",
    amount: sub.amount ?? null,
    currency: sub.currency ?? "USD",
    cycle: sub.cycle ?? "unknown",
    nextDueAt: sub.nextDueAt ? new Date(sub.nextDueAt) : null,
    isTrial: sub.isTrial ?? false,
    cancelUrl: sub.cancelUrl ?? unsub.httpsUrl ?? null,
    unsubData: JSON.stringify(unsub),
    confidence: sub.confidence ?? 0.6,
    reviewNeeded: (sub.confidence ?? 0.6) < 0.5,
    source: "email",
  };

  const existing = (await prisma.subscription.findMany()).find((e) => sameService(e.merchant || e.name, data.merchant));
  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data });
    return { ok: true, message: `Updated ${data.name} from the receipt.`, id: existing.id };
  }
  const created = await prisma.subscription.create({ data: { ...data, firstSeenAt: new Date() } });
  return { ok: true, message: `Captured ${data.name} from the receipt.`, id: created.id };
}

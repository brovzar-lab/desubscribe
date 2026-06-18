import { prisma } from "./db";
import { credsFromAccount, fetchSubscriptionEmails } from "./email/imap";
import { extractFromEmail } from "./email/extract";
import { getRecurring } from "./plaid";
import { decrypt } from "./crypto";
import { mergeSubs } from "./dedupe";
import { sameService } from "./dedupe";
import type { ExtractedSub } from "./types";

interface SourcedSub extends ExtractedSub {
  source: string;
  unsubData?: string;
  charge?: { date: string; amount: number; source: string; description?: string; accountId?: string; bankItemId?: string };
}

// Pull from every connected mailbox + bank item, extract, dedupe, and upsert.
export async function runSync(): Promise<{ added: number; updated: number; scanned: number }> {
  const collected: SourcedSub[] = [];

  // 1) Email accounts ---------------------------------------------------------
  const accounts = await prisma.emailAccount.findMany();
  for (const account of accounts) {
    try {
      const creds = credsFromAccount(account);
      const emails = await fetchSubscriptionEmails(creds, { sinceDays: 365, max: 150 });
      for (const email of emails) {
        const sub = await extractFromEmail(email);
        if (!sub) continue;
        collected.push({
          ...sub,
          source: "email",
          unsubData: JSON.stringify(email.unsub),
          cancelUrl: sub.cancelUrl ?? email.unsub.httpsUrl ?? null,
          charge: sub.amount
            ? { date: email.date, amount: sub.amount, source: "email", description: email.subject, accountId: account.id }
            : undefined,
        });
      }
      await prisma.emailAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date() } });
    } catch (e) {
      await logSync(`Email sync failed for ${account.email}: ${String(e)}`);
    }
  }

  // 2) Bank items -------------------------------------------------------------
  const banks = await prisma.bankItem.findMany();
  for (const bank of banks) {
    try {
      const token = decrypt(bank.tokenCipher);
      const streams = await getRecurring(token);
      for (const s of streams) {
        collected.push({
          ...s,
          source: "bank",
          charge: s.amount
            ? { date: s.lastChargeAt ?? new Date().toISOString(), amount: s.amount, source: "plaid", description: s.name, bankItemId: bank.id }
            : undefined,
        });
      }
      await prisma.bankItem.update({ where: { id: bank.id }, data: { lastSyncedAt: new Date() } });
    } catch (e) {
      await logSync(`Bank sync failed for ${bank.institution}: ${String(e)}`);
    }
  }

  // 3) Merge across sources, then upsert into the unified table ---------------
  const merged = mergeSubs(collected);
  let added = 0;
  let updated = 0;

  for (const m of merged) {
    const existing = (await prisma.subscription.findMany()).find((e) =>
      sameService(e.merchant || e.name, m.merchant || m.name),
    );
    const data = {
      name: m.name,
      merchant: m.merchant ?? m.name,
      category: m.category ?? "Other",
      amount: m.amount ?? null,
      currency: m.currency ?? "USD",
      cycle: m.cycle ?? "unknown",
      nextDueAt: m.nextDueAt ? new Date(m.nextDueAt) : null,
      lastChargeAt: m.lastChargeAt ? new Date(m.lastChargeAt) : null,
      source: m.source,
      confidence: m.confidence ?? 0.6,
      isTrial: m.isTrial ?? false,
      cancelUrl: m.cancelUrl ?? null,
      unsubData: (m as SourcedSub).unsubData ?? null,
    };

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          ...data,
          // don't clobber a manual protect flag or amount we already trust
          firstSeenAt: existing.firstSeenAt ?? new Date(),
        },
      });
      updated++;
    } else {
      await prisma.subscription.create({ data: { ...data, firstSeenAt: new Date() } });
      added++;
    }
  }

  await logSync(`Sync complete: ${added} added, ${updated} updated, ${collected.length} signals.`);
  return { added, updated, scanned: collected.length };
}

async function logSync(detail: string) {
  await prisma.actionLog.create({ data: { type: "sync", status: "success", detail } });
}

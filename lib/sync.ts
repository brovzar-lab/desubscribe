import { prisma } from "./db";
import { credsFromAccount, fetchSubscriptionEmails } from "./email/imap";
import { fetchGmailSubscriptionEmails } from "./email/gmail";
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
      const emails =
        account.authType === "gmail_oauth" && account.oauthCipher
          ? await fetchGmailSubscriptionEmails(account.oauthCipher, { sinceDays: 365, max: 150 })
          : await fetchSubscriptionEmails(credsFromAccount(account), { sinceDays: 365, max: 150 });
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
      // Price-change detection: record the previous amount when it moves.
      const priceMoved =
        existing.amount != null && data.amount != null && Math.abs(existing.amount - data.amount) > 0.01;
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          ...data,
          protected: existing.protected, // never clobber a manual protect flag
          reviewNeeded: (data.confidence ?? 0.6) < 0.5,
          previousAmount: priceMoved ? existing.amount : existing.previousAmount,
          priceChangedAt: priceMoved ? new Date() : existing.priceChangedAt,
          firstSeenAt: existing.firstSeenAt ?? new Date(),
        },
      });
      if (data.amount != null)
        await recordCharge(existing.id, m, data.amount);
      updated++;
    } else {
      const created = await prisma.subscription.create({
        data: { ...data, reviewNeeded: (data.confidence ?? 0.6) < 0.5, firstSeenAt: new Date() },
      });
      if (data.amount != null) await recordCharge(created.id, m, data.amount);
      added++;
    }
  }

  await logSync(`Sync complete: ${added} added, ${updated} updated, ${collected.length} signals.`);
  return { added, updated, scanned: collected.length };
}

// Record a charge as evidence/history, de-duplicated by (sub, day, amount).
async function recordCharge(subscriptionId: string, m: SourcedSub, amount: number) {
  const date = m.lastChargeAt ? new Date(m.lastChargeAt) : new Date();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400_000);
  const dupe = await prisma.chargeEvent.findFirst({
    where: { subscriptionId, amount, date: { gte: dayStart, lt: dayEnd } },
  });
  if (dupe) return;
  await prisma.chargeEvent.create({
    data: {
      subscriptionId,
      date,
      amount,
      currency: m.currency ?? "USD",
      source: m.source === "bank" ? "plaid" : m.source,
      description: m.name,
    },
  });
}

async function logSync(detail: string) {
  await prisma.actionLog.create({ data: { type: "sync", status: "success", detail } });
}

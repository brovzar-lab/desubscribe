import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Realistic demo data so the dashboard is alive on first run (no creds needed).
const DEMO = [
  { name: "Netflix", category: "Streaming", amount: 22.99, cycle: "monthly", source: "merged", confidence: 0.95, daysToDue: 11, daysSinceCharge: 19, unsub: { oneClick: true, httpsUrl: "https://example.com/unsub/netflix", mailto: null } },
  { name: "Spotify", category: "Music", amount: 11.99, cycle: "monthly", source: "bank", confidence: 0.9, daysToDue: 4, daysSinceCharge: 26 },
  { name: "Apple Music", category: "Music", amount: 10.99, cycle: "monthly", source: "email", confidence: 0.7, daysToDue: 20, daysSinceCharge: 10 },
  { name: "Adobe Creative Cloud", category: "Software", amount: 659.88, cycle: "yearly", source: "bank", confidence: 0.9, daysToDue: 90, daysSinceCharge: 275, cancelUrl: "https://account.adobe.com/plans" },
  { name: "The New York Times", category: "News", amount: 17.0, cycle: "monthly", source: "email", confidence: 0.8, daysToDue: 7, daysSinceCharge: 23, unsub: { oneClick: false, httpsUrl: null, mailto: "cancel@nytimes.example" } },
  { name: "Notion AI", category: "Software", amount: 10.0, cycle: "monthly", source: "email", confidence: 0.6, daysToDue: 14, daysSinceCharge: 90, isTrial: false },
  { name: "Disney+ (trial)", category: "Streaming", amount: 13.99, cycle: "monthly", source: "email", confidence: 0.85, daysToDue: 3, daysSinceCharge: null, isTrial: true },
  { name: "Planet Fitness", category: "Fitness", amount: 24.99, cycle: "monthly", source: "bank", confidence: 0.9, daysToDue: 9, daysSinceCharge: 110 },
  { name: "iCloud+ 2TB", category: "Cloud", amount: 9.99, cycle: "monthly", source: "bank", confidence: 0.9, daysToDue: 2, daysSinceCharge: 28 },
  { name: "Amazon Prime", category: "Shopping", amount: 139.0, cycle: "yearly", source: "merged", confidence: 0.92, daysToDue: 200, daysSinceCharge: 165 },
];

async function main() {
  // Idempotent: clear demo rows first.
  await prisma.actionLog.deleteMany({});
  await prisma.chargeEvent.deleteMany({});
  await prisma.subscription.deleteMany({});

  const now = Date.now();
  for (const d of DEMO) {
    const sub = await prisma.subscription.create({
      data: {
        name: d.name,
        merchant: d.name,
        category: d.category,
        amount: d.amount,
        cycle: d.cycle,
        source: d.source,
        confidence: d.confidence,
        isTrial: d.isTrial ?? false,
        cancelUrl: d.cancelUrl ?? null,
        unsubData: d.unsub ? JSON.stringify(d.unsub) : null,
        nextDueAt: d.daysToDue != null ? new Date(now + d.daysToDue * 86400_000) : null,
        lastChargeAt: d.daysSinceCharge != null ? new Date(now - d.daysSinceCharge * 86400_000) : null,
        firstSeenAt: new Date(now - 200 * 86400_000),
      },
    });
    if (d.amount && d.daysSinceCharge != null) {
      await prisma.chargeEvent.create({
        data: { subscriptionId: sub.id, date: new Date(now - d.daysSinceCharge * 86400_000), amount: d.amount, source: d.source === "bank" ? "plaid" : "email", description: `${d.name} charge` },
      });
    }
  }
  console.log(`Seeded ${DEMO.length} demo subscriptions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

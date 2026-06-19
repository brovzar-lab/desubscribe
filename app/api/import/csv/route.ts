import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Import subscriptions from a CSV. Flexible headers: name/service, amount/price/cost,
// cycle/billing, category, next_due/renewal. One row = one subscription.
export async function POST(req: Request) {
  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ message: "Empty CSV" }, { status: 400 });

  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (errors.length && data.length === 0)
    return NextResponse.json({ message: "Could not parse CSV: " + errors[0].message }, { status: 400 });

  let added = 0;
  for (const row of data) {
    const name = pick(row, ["name", "service", "subscription", "merchant"]);
    if (!name) continue;
    const amount = parseMoney(pick(row, ["amount", "price", "cost", "monthly", "charge"]));
    await prisma.subscription.create({
      data: {
        name,
        merchant: name,
        amount,
        currency: (pick(row, ["currency"]) || "USD").toUpperCase().slice(0, 3),
        cycle: normalizeCycle(pick(row, ["cycle", "billing", "frequency", "interval"])),
        category: pick(row, ["category", "type"]) || "Other",
        nextDueAt: parseDate(pick(row, ["next_due", "renewal", "due", "next due", "renews"])),
        source: "manual",
        confidence: 0.8,
        firstSeenAt: new Date(),
      },
    });
    added++;
  }
  return NextResponse.json({ message: `Imported ${added} subscriptions from CSV.`, added });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) if (row[k]?.trim()) return row[k].trim();
  return "";
}
function parseMoney(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function normalizeCycle(s: string): string {
  const v = s.toLowerCase();
  if (/year|annual|yr/.test(v)) return "yearly";
  if (/week/.test(v)) return "weekly";
  if (/quarter/.test(v)) return "quarterly";
  if (/month|mo/.test(v)) return "monthly";
  return "monthly";
}

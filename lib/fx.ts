import { getSetting, setSetting } from "./settings";

// Multi-currency support. Rates are "units of currency per 1 base", so to convert
// an amount in currency X to the base: baseAmount = amountX / rate[X].
// Rates come from frankfurter.dev (free, no key) and are cached for a day.

interface RateCache {
  base: string;
  date: string; // ISO day
  rates: Record<string, number>;
}

// Offline fallback so totals still work without network (approximate).
const FALLBACK: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52, JPY: 156,
  INR: 83, BRL: 5.1, MXN: 18, CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.9,
};

export async function getBaseCurrency(): Promise<string> {
  return (await getSetting("baseCurrency")) || process.env.BASE_CURRENCY || "USD";
}

export async function getRates(base: string): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const cachedRaw = await getSetting("fxRates");
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as RateCache;
    if (cached.base === base && cached.date === today) return cached.rates;
  }
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { base: string; rates: Record<string, number> };
    const rates = { ...data.rates, [base]: 1 };
    await setSetting("fxRates", JSON.stringify({ base, date: today, rates } satisfies RateCache));
    return rates;
  } catch {
    // Derive a fallback table relative to the requested base.
    const baseToUsd = FALLBACK[base] ?? 1;
    const rates: Record<string, number> = {};
    for (const [cur, perUsd] of Object.entries(FALLBACK)) rates[cur] = perUsd / baseToUsd;
    return rates;
  }
}

// Convert an amount in `from` currency into the base, using a rate map.
export function convert(amount: number, from: string, rates: Record<string, number>): number {
  const r = rates[from?.toUpperCase()] ?? 1;
  return r ? amount / r : amount;
}

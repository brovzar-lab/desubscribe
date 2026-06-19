import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import type { ExtractedSub } from "./types";

export function plaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
}

export async function createLinkToken(): Promise<string> {
  const client = plaidClient();
  const res = await client.linkTokenCreate({
    user: { client_user_id: "desubscribe-local-user" },
    client_name: "Desubscribe",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<string> {
  const client = plaidClient();
  const res = await client.itemPublicTokenExchange({ public_token: publicToken });
  return res.data.access_token;
}

// Use Plaid's recurring-transactions product: it returns recurring "streams"
// with cadence + last/predicted dates — exactly what a subscription tracker needs.
export async function getRecurring(accessToken: string): Promise<ExtractedSub[]> {
  const client = plaidClient();
  const res = await client.transactionsRecurringGet({ access_token: accessToken });
  const streams = [...res.data.outflow_streams]; // money going out = what you pay
  return streams
    .filter((s) => s.is_active)
    .map((s) => ({
      name: s.merchant_name || s.description || "Unknown",
      merchant: s.merchant_name || s.description || undefined,
      category: s.personal_finance_category?.primary || "Other",
      amount: Math.abs(s.average_amount?.amount ?? s.last_amount?.amount ?? 0),
      currency: s.last_amount?.iso_currency_code || "USD",
      cycle: mapFrequency(s.frequency),
      nextDueAt: s.predicted_next_date ?? null,
      lastChargeAt: s.last_date ?? null,
      confidence: s.status === "MATURE" ? 0.9 : 0.7,
    }));
}

function mapFrequency(freq: string): ExtractedSub["cycle"] {
  switch (freq) {
    case "WEEKLY":
    case "BIWEEKLY":
      return "weekly";
    case "MONTHLY":
      return "monthly";
    case "ANNUALLY":
      return "yearly";
    case "SEMI_MONTHLY":
      return "monthly";
    default:
      return "unknown";
  }
}

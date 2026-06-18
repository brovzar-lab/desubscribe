// Shared shapes used across extraction, dedupe, and the UI.

export type BillingCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "unknown";

// A subscription fact extracted from a single email or transaction stream.
export interface ExtractedSub {
  name: string;
  merchant?: string;
  category?: string;
  amount?: number;
  currency?: string;
  cycle?: BillingCycle;
  nextDueAt?: string | null; // ISO
  lastChargeAt?: string | null; // ISO
  isTrial?: boolean;
  cancelUrl?: string | null;
  confidence?: number; // 0..1
}

// Parsed RFC 2369 / RFC 8058 unsubscribe info from an email's headers.
export interface UnsubInfo {
  httpsUrl?: string | null;
  mailto?: string | null;
  oneClick: boolean; // List-Unsubscribe-Post: List-Unsubscribe=One-Click present
}

export type AutomationLevel = "full_auto" | "auto_marketing" | "draft_only";

import { NextResponse } from "next/server";
import { createLinkToken, plaidConfigured } from "@/lib/plaid";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!plaidConfigured())
    return NextResponse.json({ message: "Plaid keys not set (PLAID_CLIENT_ID / PLAID_SECRET)." }, { status: 400 });
  try {
    const link_token = await createLinkToken();
    return NextResponse.json({ link_token });
  } catch (e) {
    return NextResponse.json({ message: "Plaid error: " + String(e) }, { status: 500 });
  }
}

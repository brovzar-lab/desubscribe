import { NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Kick off the Google consent flow.
export async function GET() {
  if (!googleConfigured())
    return NextResponse.json(
      { message: "Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env to enable Gmail OAuth." },
      { status: 400 },
    );
  return NextResponse.redirect(authUrl());
}

import { NextResponse } from "next/server";
import { exchangeCode, encryptTokens } from "@/lib/google";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Google redirects here with ?code=… — store the mailbox as an OAuth account.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const base = process.env.APP_URL || url.origin;
  if (!code) return NextResponse.redirect(`${base}/settings?error=no_code`);

  try {
    const { email, tokens } = await exchangeCode(code);
    await prisma.emailAccount.upsert({
      where: { email },
      create: {
        email,
        provider: "gmail",
        authType: "gmail_oauth",
        oauthCipher: encryptTokens(tokens),
      },
      update: {
        authType: "gmail_oauth",
        provider: "gmail",
        oauthCipher: encryptTokens(tokens),
      },
    });
    return NextResponse.redirect(`${base}/settings?connected=${encodeURIComponent(email)}`);
  } catch (e) {
    return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(String(e))}`);
  }
}

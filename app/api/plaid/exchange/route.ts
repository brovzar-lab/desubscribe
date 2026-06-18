import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangePublicToken } from "@/lib/plaid";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({ public_token: z.string(), institution: z.string().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });
  try {
    const accessToken = await exchangePublicToken(parsed.data.public_token);
    await prisma.bankItem.create({
      data: { institution: parsed.data.institution ?? "Bank", tokenCipher: encrypt(accessToken) },
    });
    return NextResponse.json({ message: "Bank connected." });
  } catch (e) {
    return NextResponse.json({ message: "Plaid exchange failed: " + String(e) }, { status: 500 });
  }
}

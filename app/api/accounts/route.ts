import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { providerDefaults } from "@/lib/email/imap";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1), // app-password
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid email/app-password" }, { status: 400 });
  const d = parsed.data;
  const defaults = providerDefaults(d.email);

  await prisma.emailAccount.upsert({
    where: { email: d.email },
    create: {
      email: d.email,
      secretCipher: encrypt(d.password),
      imapHost: d.imapHost ?? defaults.imapHost,
      imapPort: d.imapPort ?? defaults.imapPort,
      smtpHost: d.smtpHost ?? defaults.smtpHost,
      smtpPort: d.smtpPort ?? defaults.smtpPort,
    },
    update: { secretCipher: encrypt(d.password) },
  });
  return NextResponse.json({ message: `Connected ${d.email}.` });
}

export async function GET() {
  const accounts = await prisma.emailAccount.findMany({
    select: { id: true, email: true, lastSyncedAt: true },
  });
  return NextResponse.json({ accounts });
}

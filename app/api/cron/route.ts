import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { sendDigest } from "@/lib/digest";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Scheduled entry point: sync all sources, then email the digest.
// Point an OS cron / external scheduler at this, e.g. weekly:
//   0 9 * * 1  curl -s -X POST localhost:3000/api/cron -H "x-cron-secret: $CRON_SECRET"
// If CRON_SECRET is set, the header must match.
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const sources = (await prisma.emailAccount.count()) + (await prisma.bankItem.count());
  const sync = sources > 0 ? await runSync().catch((e) => ({ error: String(e) })) : { skipped: "no sources" };
  const digest = await sendDigest();
  return NextResponse.json({ message: `Cron ran. ${digest.message}`, sync, digest: digest.ok });
}

export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}

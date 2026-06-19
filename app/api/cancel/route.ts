import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelSubscription } from "@/lib/cancel/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ id: z.string(), dryRun: z.boolean().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });

  try {
    const result = await cancelSubscription(parsed.data.id, { dryRun: parsed.data.dryRun });
    const verb = parsed.data.dryRun ? "Dry-run" : "Cancel";
    const summary = result.steps.map((s) => `${s.type}: ${s.status}`).join(" · ");
    return NextResponse.json({
      message: `${verb} → ${result.finalStatus}. ${summary}`,
      result,
    });
  } catch (e) {
    return NextResponse.json({ message: "Cancel failed: " + String(e) }, { status: 500 });
  }
}

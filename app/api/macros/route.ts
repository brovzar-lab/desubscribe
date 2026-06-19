import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { merchantKey } from "@/lib/dedupe";
import { validateSteps } from "@/lib/cancel/macro";

export const dynamic = "force-dynamic";

const Body = z.object({
  merchant: z.string().min(1),
  label: z.string().optional(),
  steps: z.array(z.object({
    action: z.enum(["goto", "click", "fill", "waitFor", "press"]),
    selector: z.string().optional(),
    value: z.string().optional(),
    url: z.string().optional(),
  })),
});

export async function GET() {
  const macros = await prisma.cancelMacro.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ macros });
}

// Save a recorded cancel macro (generate steps with `npx playwright codegen <url>`).
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid macro steps" }, { status: 400 });
  if (!validateSteps(parsed.data.steps)) return NextResponse.json({ message: "Bad steps" }, { status: 400 });

  const key = merchantKey(parsed.data.merchant);
  await prisma.cancelMacro.upsert({
    where: { merchantKey: key },
    create: { merchantKey: key, label: parsed.data.label ?? parsed.data.merchant, steps: JSON.stringify(parsed.data.steps) },
    update: { label: parsed.data.label ?? parsed.data.merchant, steps: JSON.stringify(parsed.data.steps) },
  });
  return NextResponse.json({ message: `Saved cancel macro for ${parsed.data.merchant} (${parsed.data.steps.length} steps).` });
}

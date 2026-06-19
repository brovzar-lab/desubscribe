import { NextResponse } from "next/server";
import { z } from "zod";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  automationLevel: z.enum(["full_auto", "auto_marketing", "draft_only"]).optional(),
  killSwitch: z.enum(["on", "off"]).optional(),
  anthropicApiKey: z.string().optional(),
  baseCurrency: z.string().length(3).optional(),
  digestEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined && v !== "") await setSetting(k, v);
  }
  return NextResponse.json({ message: "Settings saved." });
}

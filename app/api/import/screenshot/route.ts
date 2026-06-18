import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClient, EXTRACT_MODEL, parseJson } from "@/lib/anthropic";
import type { ExtractedSub } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Extract subscriptions from a screenshot (bank app, billing page, app store
// subscriptions list…) using Claude vision. Accepts multipart form with `image`.
export async function POST(req: Request) {
  const client = await getClient();
  if (!client)
    return NextResponse.json({ message: "Screenshot import needs a Claude API key (Settings)." }, { status: 400 });

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File))
    return NextResponse.json({ message: "No image uploaded." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mediaType = (file.type || "image/png") as "image/png" | "image/jpeg" | "image/webp";

  const msg = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 1500,
    system:
      "Extract every subscription/recurring charge visible in the image. Return ONLY JSON array: " +
      `[{"name":string,"amount":number|null,"currency":string,"cycle":"weekly|monthly|quarterly|yearly|unknown","category":string,"isTrial":boolean,"confidence":0..1}]`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } },
          { type: "text", text: "List every subscription you can see." },
        ],
      },
    ],
  });

  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const subs = parseJson<ExtractedSub[]>(text);
  if (!subs || !Array.isArray(subs))
    return NextResponse.json({ message: "Couldn't read any subscriptions from that image." }, { status: 422 });

  let added = 0;
  for (const s of subs) {
    if (!s.name) continue;
    await prisma.subscription.create({
      data: {
        name: s.name,
        merchant: s.merchant ?? s.name,
        amount: s.amount ?? null,
        currency: s.currency ?? "USD",
        cycle: s.cycle ?? "monthly",
        category: s.category ?? "Other",
        isTrial: s.isTrial ?? false,
        source: "manual",
        confidence: s.confidence ?? 0.7,
        firstSeenAt: new Date(),
      },
    });
    added++;
  }
  return NextResponse.json({ message: `Imported ${added} subscriptions from screenshot.`, added });
}

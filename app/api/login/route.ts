import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify the app password and set an httpOnly auth cookie.
export async function POST(req: Request) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.json({ message: "No password set — app is open." });
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (password !== pw) return NextResponse.json({ message: "Wrong password." }, { status: 401 });

  const res = NextResponse.json({ message: "Signed in." });
  res.cookies.set("desub_auth", await sha256hex(pw), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

// Sign out.
export async function DELETE() {
  const res = NextResponse.json({ message: "Signed out." });
  res.cookies.delete("desub_auth");
  return res;
}

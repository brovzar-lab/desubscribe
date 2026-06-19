import { NextResponse, type NextRequest } from "next/server";

// Optional single-user password lock. Active only when APP_PASSWORD is set; the
// app stays open (good for local use) otherwise. Webhook/cron have their own
// token auth and are exempt from the cookie check.
export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const exempt =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/api/cron");
  if (exempt) return NextResponse.next();

  const token = req.cookies.get("desub_auth")?.value;
  const expected = await sha256hex(pw);
  if (token === expected) return NextResponse.next();

  if (pathname.startsWith("/api"))
    return NextResponse.json({ message: "Locked — sign in." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

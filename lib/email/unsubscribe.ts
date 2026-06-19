import type { UnsubInfo } from "../types";

// Parse the List-Unsubscribe / List-Unsubscribe-Post headers (RFC 2369 + RFC 8058).
// Example header: List-Unsubscribe: <https://x.com/u?t=abc>, <mailto:unsub@x.com?subject=stop>
export function parseUnsubscribe(headers: {
  listUnsubscribe?: string | null;
  listUnsubscribePost?: string | null;
}): UnsubInfo {
  const out: UnsubInfo = { oneClick: false, httpsUrl: null, mailto: null };
  const raw = headers.listUnsubscribe;
  if (raw) {
    const links = raw.match(/<([^>]+)>/g)?.map((s) => s.slice(1, -1).trim()) ?? [];
    for (const link of links) {
      if (/^https:\/\//i.test(link) && !out.httpsUrl) out.httpsUrl = link;
      else if (/^mailto:/i.test(link) && !out.mailto) out.mailto = link.replace(/^mailto:/i, "");
    }
  }
  // One-click requires the Post header AND an https target (RFC 8058).
  if (
    headers.listUnsubscribePost &&
    /List-Unsubscribe\s*=\s*One-Click/i.test(headers.listUnsubscribePost) &&
    out.httpsUrl
  ) {
    out.oneClick = true;
  }
  return out;
}

// Execute a one-click unsubscribe: POST `List-Unsubscribe=One-Click` to the https URI.
// No cookies/credentials are sent (per spec). Returns true on a 2xx.
export async function oneClickUnsubscribe(httpsUrl: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(httpsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
    redirect: "follow",
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

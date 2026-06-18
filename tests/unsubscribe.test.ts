import { describe, it, expect } from "vitest";
import { parseUnsubscribe } from "@/lib/email/unsubscribe";

describe("parseUnsubscribe (RFC 2369 / 8058)", () => {
  it("extracts https + mailto and detects one-click", () => {
    const info = parseUnsubscribe({
      listUnsubscribe: "<https://news.example.com/u?token=abc>, <mailto:unsub@example.com?subject=stop>",
      listUnsubscribePost: "List-Unsubscribe=One-Click",
    });
    expect(info.httpsUrl).toBe("https://news.example.com/u?token=abc");
    expect(info.mailto).toBe("unsub@example.com?subject=stop");
    expect(info.oneClick).toBe(true);
  });

  it("does not flag one-click without the Post header", () => {
    const info = parseUnsubscribe({
      listUnsubscribe: "<https://x.com/u?t=1>",
      listUnsubscribePost: null,
    });
    expect(info.oneClick).toBe(false);
    expect(info.httpsUrl).toBe("https://x.com/u?t=1");
  });

  it("does not flag one-click when only mailto is present", () => {
    const info = parseUnsubscribe({
      listUnsubscribe: "<mailto:unsub@x.com>",
      listUnsubscribePost: "List-Unsubscribe=One-Click",
    });
    expect(info.oneClick).toBe(false); // needs an https target
    expect(info.mailto).toBe("unsub@x.com");
  });

  it("handles empty headers", () => {
    const info = parseUnsubscribe({ listUnsubscribe: null, listUnsubscribePost: null });
    expect(info).toEqual({ oneClick: false, httpsUrl: null, mailto: null });
  });
});

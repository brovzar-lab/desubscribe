import { describe, it, expect } from "vitest";
import { merchantKey, sameService, mergeSubs } from "@/lib/dedupe";

describe("merchantKey", () => {
  it("strips payment-descriptor noise and ref numbers", () => {
    expect(merchantKey("SQ *NETFLIX RECURRING #12345")).toBe("netflix");
    expect(merchantKey("Netflix.com")).toContain("netflix");
  });
});

describe("sameService", () => {
  it("matches email name to bank descriptor", () => {
    expect(sameService("Netflix", "SQ *NETFLIX PAYMENT")).toBe(true);
    expect(sameService("Spotify", "Netflix")).toBe(false);
  });
});

describe("mergeSubs", () => {
  it("merges email + bank into one service, bank wins on amount", () => {
    const merged = mergeSubs([
      { name: "Netflix", source: "email", amount: 0, cycle: "monthly", cancelUrl: "https://netflix.com/cancel", confidence: 0.6 },
      { name: "NETFLIX.COM", source: "bank", amount: 22.99, cycle: "monthly", confidence: 0.9 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].amount).toBe(22.99); // bank authoritative
    expect(merged[0].cancelUrl).toBe("https://netflix.com/cancel"); // email contributes cancel
    expect(merged[0].sources.sort()).toEqual(["bank", "email"]);
    expect(merged[0].source).toBe("merged");
  });

  it("keeps distinct services separate", () => {
    const merged = mergeSubs([
      { name: "Netflix", source: "bank", amount: 22.99, confidence: 0.9 },
      { name: "Spotify", source: "bank", amount: 11.99, confidence: 0.9 },
    ]);
    expect(merged).toHaveLength(2);
  });
});

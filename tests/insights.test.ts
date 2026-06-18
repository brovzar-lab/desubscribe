import { describe, it, expect } from "vitest";
import { monthlyAmount, totals, computeInsights, type SubLike } from "@/lib/insights";

describe("monthlyAmount", () => {
  it("normalizes cycles to monthly", () => {
    expect(monthlyAmount(120, "yearly")).toBe(10);
    expect(monthlyAmount(30, "quarterly")).toBe(10);
    expect(monthlyAmount(10, "monthly")).toBe(10);
    expect(Math.round(monthlyAmount(10, "weekly"))).toBe(43);
  });
});

function sub(p: Partial<SubLike>): SubLike {
  return {
    id: Math.random().toString(),
    name: "X",
    amount: 10,
    cycle: "monthly",
    status: "active",
    category: "Other",
    nextDueAt: null,
    lastChargeAt: null,
    isTrial: false,
    source: "bank",
    ...p,
  };
}

describe("totals", () => {
  it("sums monthly-equivalent of active subs only", () => {
    const t = totals([
      sub({ amount: 120, cycle: "yearly" }), // 10/mo
      sub({ amount: 5, cycle: "monthly" }), // 5/mo
      sub({ amount: 99, cycle: "monthly", status: "cancelled" }), // ignored
    ]);
    expect(t.monthly).toBe(15);
    expect(t.yearly).toBe(180);
    expect(t.count).toBe(2);
  });
});

describe("computeInsights", () => {
  it("flags a trial about to convert", () => {
    const i = computeInsights([sub({ name: "Disney+", isTrial: true, nextDueAt: new Date(Date.now() + 2 * 86400_000) })]);
    expect(i.some((x) => x.kind === "trial_converting")).toBe(true);
  });

  it("flags duplicate categories", () => {
    const i = computeInsights([
      sub({ name: "Spotify", category: "Music" }),
      sub({ name: "Apple Music", category: "Music" }),
    ]);
    expect(i.some((x) => x.kind === "duplicate")).toBe(true);
  });
});

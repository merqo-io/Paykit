import { describe, it, expect } from "vitest";
import { resolvePlanView } from "./plan-view";

describe("resolvePlanView", () => {
  it("labels a free vendor Free, singular count, no nudge, upgrade shown", () => {
    const view = resolvePlanView("free", 1, 499);
    expect(view.planLabel).toBe("Free");
    expect(view.countLabel).toBe("1 transaction this month");
    expect(view.showNudge).toBe(false);
    expect(view.showUpgrade).toBe(true);
  });

  it("uses plural count copy for zero and for more than one", () => {
    expect(resolvePlanView("free", 0, 499).countLabel).toBe(
      "0 transactions this month",
    );
    expect(resolvePlanView("free", 2, 499).countLabel).toBe(
      "2 transactions this month",
    );
  });

  it("shows the Pro nudge once a free vendor crosses the usage threshold", () => {
    expect(resolvePlanView("free", 49, 499).showNudge).toBe(false);
    expect(resolvePlanView("free", 50, 499).showNudge).toBe(true);
  });

  it("compares Free and Pro: revenue stats on both, refund tracking on Pro only, the live price", () => {
    expect(resolvePlanView("free", 0, 499).comparisonRows).toEqual([
      { label: "Price", values: { free: "$0", pro: "$4.99/mo" } },
      { label: "Unlimited transactions", values: { free: true, pro: true } },
      { label: "Revenue stats", values: { free: true, pro: true } },
      { label: "Refund tracking", values: { free: false, pro: true } },
    ]);
  });

  it("pro shows the same comparison, never nudges or upsells", () => {
    const view = resolvePlanView("pro", 500, 499);
    expect(view.planLabel).toBe("Pro");
    expect(view.comparisonRows).toEqual(
      resolvePlanView("free", 0, 499).comparisonRows,
    );
    expect(view.showNudge).toBe(false);
    expect(view.showUpgrade).toBe(false);
  });

  it("formats the live monthly price for display", () => {
    expect(resolvePlanView("free", 0, 499).proPriceLabel).toBe("$4.99/mo");
    expect(resolvePlanView("free", 0, 1200).proPriceLabel).toBe("$12.00/mo");
  });
});

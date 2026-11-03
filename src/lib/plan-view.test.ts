import { describe, it, expect } from "vitest";
import { resolvePlanView } from "./plan-view";

describe("resolvePlanView", () => {
  it("labels a free vendor Free with singular count copy", () => {
    const view = resolvePlanView("free", 1);
    expect(view.planLabel).toBe("Free");
    expect(view.countLabel).toBe("1 transaction this month");
  });

  it("uses plural count copy for zero and for more than one", () => {
    expect(resolvePlanView("free", 0).countLabel).toBe(
      "0 transactions this month",
    );
    expect(resolvePlanView("free", 2).countLabel).toBe(
      "2 transactions this month",
    );
  });

  it("compares Free and Pro without any price row", () => {
    const rows = resolvePlanView("free", 0).comparisonRows;
    expect(rows).toEqual([
      { label: "Unlimited transactions", values: { free: true, pro: true } },
      { label: "Revenue stats", values: { free: true, pro: true } },
      { label: "Refund tracking", values: { free: false, pro: true } },
    ]);
  });

  it("pro labels Pro and shows the same comparison", () => {
    const view = resolvePlanView("pro", 500);
    expect(view.planLabel).toBe("Pro");
    expect(view.comparisonRows).toEqual(
      resolvePlanView("free", 0).comparisonRows,
    );
  });
});

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

  it("labels a pro vendor Pro", () => {
    const view = resolvePlanView("pro", 500);
    expect(view.planLabel).toBe("Pro");
    expect(view.countLabel).toBe("500 transactions this month");
  });
});

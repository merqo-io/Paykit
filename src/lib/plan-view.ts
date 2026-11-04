import type { VendorPlan } from "@/lib/types";

export interface PlanView {
  plan: VendorPlan;
  planLabel: "Free" | "Pro";
  countLabel: string;
}

/**
 * Pure view-model for the Plan page: the plan label and the transaction-count
 * copy. No price or plan feature copy lives here because merqo owns the
 * catalog; the page renders it via `@merqo/ui`'s `PricingLadder`.
 */
export function resolvePlanView(
  plan: VendorPlan,
  countThisMonth: number,
): PlanView {
  return {
    plan,
    planLabel: plan === "pro" ? "Pro" : "Free",
    countLabel: `${countThisMonth} transaction${countThisMonth === 1 ? "" : "s"} this month`,
  };
}

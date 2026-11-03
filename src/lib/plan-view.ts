import type { PlanComparisonRow } from "@merqo/ui";
import type { VendorPlan } from "@/lib/types";

export interface PlanView {
  plan: VendorPlan;
  planLabel: "Free" | "Pro";
  countLabel: string;
  /** Free vs Pro rows for `@merqo/ui`'s `PlanComparisonTable`, the same for either plan. */
  comparisonRows: PlanComparisonRow[];
}

/**
 * Pure view-model for the Plan page: the Free vs Pro comparison rows and the
 * transaction-count copy. No price appears here because merqo owns pricing and
 * the plan page only points vendors back to their Merqo account. Revenue stats
 * are free for every vendor; refund tracking is Pro's one gate.
 */
export function resolvePlanView(
  plan: VendorPlan,
  countThisMonth: number,
): PlanView {
  return {
    plan,
    planLabel: plan === "pro" ? "Pro" : "Free",
    countLabel: `${countThisMonth} transaction${countThisMonth === 1 ? "" : "s"} this month`,
    comparisonRows: [
      { label: "Unlimited transactions", values: { free: true, pro: true } },
      { label: "Revenue stats", values: { free: true, pro: true } },
      { label: "Refund tracking", values: { free: false, pro: true } },
    ],
  };
}

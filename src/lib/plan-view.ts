import type { VendorPlan } from "@/lib/types";

// merqo-ui exports tierLabel from a client-only module, which a Server Component
// importing this file cannot load; the labels mirror its output.
const TIER_LABEL: Record<VendorPlan, string> = {
  free: "Free",
  pro: "Pro",
};

export interface PlanView {
  plan: VendorPlan;
  planLabel: string;
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
    planLabel: TIER_LABEL[plan],
    countLabel: `${countThisMonth} transaction${countThisMonth === 1 ? "" : "s"} this month`,
  };
}

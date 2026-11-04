import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { txCountThisMonth } from "@/lib/transactions";
import { resolvePlanView } from "@/lib/plan-view";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { merqoBaseUrl } from "@/lib/merqo-url";
import { PricingLadder, fetchPlanCatalog } from "@merqo/ui";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Plan",
};

export const revalidate = 0;

export default async function PlanPage() {
  const { supabase, user } = await getVendorSession();
  const [plan, count, catalog] = await Promise.all([
    readVendorPlan(supabase, user.id),
    txCountThisMonth(user.id),
    fetchPlanCatalog(merqoBaseUrl()).catch(() => null),
  ]);
  const view = resolvePlanView(plan ?? "free", count);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Billing" title="Plan" className="mb-0" />

      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">
          Current plan: {view.plan === "pro" ? "Pro" : "Free"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{view.countLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Change plan from your Merqo account.
        </p>
      </div>

      {catalog ? (
        <PricingLadder catalog={catalog} highlight="all_access" />
      ) : (
        <p className="text-sm text-muted-foreground">
          Prices are unavailable right now. Your plan is unaffected.
        </p>
      )}
    </div>
  );
}

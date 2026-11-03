import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { txCountThisMonth } from "@/lib/transactions";
import { resolvePlanView } from "@/lib/plan-view";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { BackButton, PlanComparisonTable } from "@merqo/ui";

export const metadata: Metadata = {
  title: "Plan",
};

export const revalidate = 0;

export default async function PlanPage() {
  const { supabase, user } = await getVendorSession();
  const [plan, count] = await Promise.all([
    readVendorPlan(supabase, user.id),
    txCountThisMonth(user.id),
  ]);
  const view = resolvePlanView(plan ?? "free", count);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <BackButton href="/dashboard" label="Dashboard" />
      </div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Your account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
      </header>

      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">
          Current plan: <span className="capitalize">{view.plan}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{view.countLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Change plan from your Merqo account.
        </p>
      </div>

      <PlanComparisonTable
        tiers={[
          { key: "free", label: "Free" },
          { key: "pro", label: "Pro" },
        ]}
        rows={view.comparisonRows}
      />
    </div>
  );
}

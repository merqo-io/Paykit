import type { Metadata } from "next";
import { getVendorSession, getVendorPlan } from "@/lib/vendor-session";
import { txCountThisMonth } from "@/lib/transactions";
import { resolvePlanView } from "@/lib/plan-view";
import { getPricing } from "@/lib/pricing";
import { BackButton, PlanComparisonTable } from "@merqo/ui";
import { UpgradeCta } from "./upgrade-cta";

export const metadata: Metadata = {
  title: "Plan",
};

export const revalidate = 0;

export default async function PlanPage() {
  const { supabase, user } = await getVendorSession();
  const [config, count, pricing] = await Promise.all([
    getVendorPlan(supabase, user.id),
    txCountThisMonth(user.id),
    getPricing(supabase),
  ]);
  const plan = config?.plan ?? "free";
  const view = resolvePlanView(plan, count, pricing.monthly_cents);

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
        {view.showNudge && (
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re doing real volume — Pro adds refund tracking,{" "}
            {view.proPriceLabel}.
          </p>
        )}
      </div>

      <PlanComparisonTable
        tiers={[
          { key: "free", label: "Free" },
          { key: "pro", label: "Pro" },
        ]}
        rows={view.comparisonRows}
      />

      {view.showUpgrade && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Ask us to upgrade your account to Pro for refund tracking,{" "}
            {view.proPriceLabel}.
          </p>
          <UpgradeCta />
          <p className="mt-2 text-xs text-muted-foreground">
            We usually action this within one business day.
          </p>
        </div>
      )}
    </div>
  );
}

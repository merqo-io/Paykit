import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getVendorSession } from "@/lib/vendor-session";
import { countTransactionsBefore, txCountThisMonth } from "@/lib/transactions";
import { freeListCutoff, FREE_LIST_DAYS, isPaidPlan } from "@/lib/free-limits";
import { resolvePlanView } from "@/lib/plan-view";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { merqoBaseUrl } from "@merqo/ui/kit-api";
import { PricingLadder, fetchPlanCatalog } from "@merqo/ui";
import { PageHeader } from "@merqo/ui";

export const metadata: Metadata = {
  title: "Plan",
};

export const revalidate = 0;

// The ladder only accepts "qkit" or "all_access" as a highlight and the
// catalog has no paykit-only plan; the qkit plan includes full paykit, so a
// paid vendor sits on that entry. Free has no ladder entry of its own.
const PAID_SLUG = "qkit";

function describePlans(plan: string): Record<string, ReactNode> {
  return {
    [plan === "pro" ? PAID_SLUG : plan]: (
      <span className="font-semibold text-primary">Your current plan</span>
    ),
  };
}

function catalogInit(): RequestInit | undefined {
  const secret = process.env.MERQO_CUSTOMER_SECRET;
  return secret
    ? { headers: { Authorization: `Bearer ${secret}` } }
    : undefined;
}

export default async function PlanPage() {
  const { supabase, user } = await getVendorSession();
  const [plan, count, catalog] = await Promise.all([
    readVendorPlan(supabase, user.id),
    txCountThisMonth(user.id),
    fetchPlanCatalog(merqoBaseUrl(), catalogInit()).catch(() => null),
  ]);
  const view = resolvePlanView(plan ?? "free", count);
  const paid = isPaidPlan(plan);
  const hidden = paid
    ? 0
    : await countTransactionsBefore(user.id, freeListCutoff());
  const currentSlug = view.plan === "pro" ? PAID_SLUG : view.plan;
  const currentListed = catalog?.plans.some((p) => p.slug === currentSlug);
  const accountHref = `${merqoBaseUrl()}/account`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader responsive title="Plan" className="mb-0" />

      <section className="space-y-2">
        <p className="text-lg font-semibold">
          You are on {view.plan === "pro" ? "Pro" : "Free"}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {view.countLabel}
        </p>
        <a
          href={accountHref}
          className="inline-block text-sm underline underline-offset-4"
        >
          Change plan in your Merqo account
        </a>
      </section>

      {paid ? null : (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">What paid plans add</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Full payment history with search. Free keeps the last{" "}
              {FREE_LIST_DAYS} days.
            </li>
            <li>All reports and CSV export.</li>
            <li>Refund tracking.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Starter and Pro both include everything in paykit.
          </p>
          {hidden > 0 ? (
            <p className="text-sm tabular-nums">
              {hidden} older {hidden === 1 ? "payment is" : "payments are"}{" "}
              hidden on Free.
            </p>
          ) : null}
        </section>
      )}

      {catalog && !currentListed ? (
        <p className="text-sm text-muted-foreground">
          You are on the {view.planLabel} plan.
        </p>
      ) : null}

      {catalog ? (
        <PricingLadder
          catalog={catalog}
          highlight={PAID_SLUG}
          descriptions={describePlans(view.plan)}
          showEventPass={false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Prices are unavailable right now. Your plan is unaffected.{" "}
          <a href="/dashboard/plan" className="underline underline-offset-4">
            Try again
          </a>
        </p>
      )}
    </div>
  );
}

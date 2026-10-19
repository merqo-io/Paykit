import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import { txCountThisMonth } from "@/lib/transactions";
import { shouldNudgePro } from "@/lib/usage";
import { stampTourSeen } from "@/lib/tour-prefs";
import { getPricing } from "@/lib/pricing";
import { formatCents } from "@/lib/utils";
import { getConfig } from "./config/actions";
import type { VendorPaymentConfig } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Middle-mask an identifier (UEN/mobile) for the dashboard summary card —
// enough for a vendor to recognize their own config at a glance without
// putting the full number on screen. Values too short to usefully mask
// (shouldn't happen given the config form's own validation, but keep this
// total) fall back to a fixed-width mask.
function maskIdentifier(value: string): string {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

function paymentMethodSummary(config: VendorPaymentConfig): {
  kindLabel: string;
  identifier: string;
} {
  if (config.kind === "paynow") {
    const raw = config.uen ?? config.mobile ?? "";
    return {
      kindLabel: "PayNow QR",
      identifier: raw ? maskIdentifier(raw) : "—",
    };
  }
  return {
    kindLabel: "Payment link or QR image",
    identifier: config.label ?? "—",
  };
}

export default async function DashboardPage() {
  const { supabase, user } = await getVendorSession();

  const [config, count, { data: prefs }, pricing] = await Promise.all([
    getConfig(),
    txCountThisMonth(user.id),
    supabase
      .from("vendor_prefs")
      .select("tour_seen_at")
      .eq("vendor_id", user.id)
      .maybeSingle(),
    getPricing(supabase),
  ]);
  // Durable "start" stamp, in addition to dashboard-tour.tsx's client-fired
  // one: this route (not layout.tsx, which wraps every /dashboard/* page)
  // is specifically the tour's home route, so stamping here — synchronously,
  // as part of this request — lands before the response is even sent, no
  // matter what happens client-side afterwards. See tour-actions.ts's
  // stampTourSeen/markTourSeen comments for the hard-navigation race this
  // closes.
  if (!prefs?.tour_seen_at) {
    await stampTourSeen(supabase, user.id);
  }

  const plan = config?.plan ?? "free";
  const methodSummary = config ? paymentMethodSummary(config) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {!config && (
        <p className="rounded-xl border bg-secondary/50 p-4 text-sm">
          You haven&apos;t set up payments yet.{" "}
          <Link
            href="/dashboard/config"
            className="underline underline-offset-4"
          >
            Set it up
          </Link>
          .
        </p>
      )}

      {methodSummary && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment method
              </p>
              <p className="mt-1 truncate text-sm font-medium">
                {methodSummary.kindLabel} · {methodSummary.identifier}
              </p>
            </div>
            <Link
              href="/dashboard/config"
              className="shrink-0 text-sm underline underline-offset-4"
            >
              Edit
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4" data-tour="tx-count">
        <p className="text-sm font-medium">
          {count} transaction{count === 1 ? "" : "s"} this month
        </p>
      </div>

      {shouldNudgePro(plan, count) && (
        <div className="rounded-xl border border-mint/30 bg-mint/10 p-4">
          <p className="text-sm font-medium">
            You&apos;re doing real volume —{" "}
            <Link
              href="/dashboard/plan"
              className="underline underline-offset-4"
            >
              Pro
            </Link>{" "}
            adds refund tracking, {`${formatCents(pricing.monthly_cents)}/mo`}.
          </p>
        </div>
      )}
    </div>
  );
}

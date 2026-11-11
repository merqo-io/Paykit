import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import { claimedTxCount, txCountThisMonth } from "@/lib/transactions";
import { stampTourSeen } from "@/lib/tour-prefs";
import { getConfig } from "./config/actions";
import type { VendorPaymentConfig } from "@/lib/types";
import { PageHeader } from "@merqo/ui";
import { buttonVariants } from "@merqo/ui/primitives";

import { FORM_LABEL_CLASS } from "@merqo/ui";

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
      identifier: raw ? maskIdentifier(raw) : "Not set",
    };
  }
  return {
    kindLabel: "Payment link or QR image",
    identifier: config.label ?? "Not set",
  };
}

export default async function DashboardPage() {
  const { supabase, user } = await getVendorSession();

  const [config, count, toConfirm, { data: prefs }] = await Promise.all([
    getConfig(),
    txCountThisMonth(user.id),
    claimedTxCount(user.id),
    supabase
      .from("vendor_prefs")
      .select("tour_seen_at")
      .eq("vendor_id", user.id)
      .maybeSingle(),
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

  const methodSummary = config ? paymentMethodSummary(config) : null;
  return (
    <div>
      <PageHeader
        responsive
        eyebrow="Overview"
        title="Payments at a glance"
        action={
          !config ? (
            <Link
              href="/dashboard/config"
              className={buttonVariants({ size: "lg" })}
            >
              Set up payments
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className={FORM_LABEL_CLASS}>Payment method</p>
          <p className="mt-2 truncate text-sm font-medium">
            {methodSummary
              ? `${methodSummary.kindLabel} · ${methodSummary.identifier}`
              : "Not set"}
          </p>
          <Link
            href="/dashboard/config"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            {methodSummary ? "Edit payment setup" : "Open payment setup"}
          </Link>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className={FORM_LABEL_CLASS}>To confirm</p>
          <p className="mt-2 text-2xl font-semibold">{toConfirm}</p>
          <p className="text-sm text-muted-foreground">
            {toConfirm === 1 ? "payment" : "payments"} waiting for you
          </p>
          <Link
            href="/dashboard/transactions"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            View payments
          </Link>
        </div>

        <div className="rounded-xl border bg-card p-5" data-tour="tx-count">
          <p className={FORM_LABEL_CLASS}>This month</p>
          <p className="mt-2 text-sm font-medium">
            {count} payment{count === 1 ? "" : "s"} this month
          </p>
        </div>
      </div>
    </div>
  );
}

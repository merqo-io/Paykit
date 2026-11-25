import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import { claimedTxSummary, confirmedSince } from "@/lib/transactions";
import { sgtDate } from "@/lib/free-limits";
import { formatCents } from "@/lib/utils";
import { stampTourSeen } from "@/lib/tour-prefs";
import { getConfig } from "./config/actions";
import type { VendorPaymentConfig } from "@/lib/types";
import { PageHeader, StatCard } from "@merqo/ui";
import { buttonVariants } from "@merqo/ui/primitives";

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
  const { supabase, user } = await getVendorSession("/dashboard");

  // Singapore has no DST, so the first of the month is a fixed +08:00 offset.
  const monthStartIso = new Date(
    `${sgtDate(new Date().toISOString()).slice(0, 7)}-01T00:00:00+08:00`,
  ).toISOString();

  const [config, toConfirm, month, { data: prefs }] = await Promise.all([
    getConfig(),
    claimedTxSummary(user.id),
    confirmedSince(user.id, monthStartIso),
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

  if (!config) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader responsive title="Payments" />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Add your PayNow details to start taking payments
          </h2>
          <p className="text-sm text-muted-foreground">
            Customers scan your QR in their bank app. You confirm each payment
            here once it lands in your account.
          </p>
          <Link
            href="/dashboard/config"
            className={buttonVariants({ size: "lg" })}
          >
            Set up payments
          </Link>
        </section>
      </div>
    );
  }

  const waitingNoun = `${toConfirm.count} ${toConfirm.count === 1 ? "payment" : "payments"}`;
  const methodSummary = paymentMethodSummary(config);
  return (
    <div>
      <PageHeader responsive title="Payments" />

      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard
          label="Waiting for you to confirm"
          value={formatCents(toConfirm.cents)}
          caption={
            toConfirm.count === 0
              ? "Nothing to confirm right now."
              : `${waitingNoun} marked paid by customers`
          }
        />

        <div data-tour="tx-count">
          <StatCard
            label="Confirmed this month"
            value={formatCents(month.cents)}
            caption={`${month.count} confirmed payment${month.count === 1 ? "" : "s"}`}
          />
        </div>
      </div>

      <Link
        href={
          toConfirm.count === 0
            ? "/dashboard/transactions"
            : "/dashboard/transactions?status=claimed"
        }
        className="mt-4 inline-block text-sm underline underline-offset-4"
      >
        {toConfirm.count === 0 ? "View payments" : "Review these payments"}
      </Link>

      <section className="mt-8 space-y-1">
        <h2 className="text-sm font-medium text-muted-foreground">
          Payment method
        </h2>
        <p className="truncate text-sm font-medium">
          {`${methodSummary.kindLabel} · ${methodSummary.identifier}`}
        </p>
        <Link
          href="/dashboard/config"
          className="inline-block text-sm underline underline-offset-4"
        >
          Edit payment setup
        </Link>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import {
  claimedTxSummary,
  confirmedSince,
  queryTransactions,
} from "@/lib/transactions";
import { isPaidPlan, sgtDate } from "@/lib/free-limits";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { deriveOnboarding } from "@/lib/onboarding";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getConfig } from "./config/actions";
import type { VendorPaymentConfig } from "@/lib/types";
import { TransactionStatusBadge } from "./transactions/transaction-status-badge";
import { PageHeader, StatCard, Money, Timestamp, formatMoney } from "@merqo/ui";
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

type VendorSupabase = Awaited<ReturnType<typeof getVendorSession>>["supabase"];

async function loadOnboarding(
  supabase: VendorSupabase,
  vendorId: string,
  hasConfig: boolean,
  prefs: {
    tour_seen_at: string | null;
    onboarding_dismissed_at: string | null;
    qr_previewed_at: string | null;
  } | null,
) {
  const dismissedAt = prefs?.onboarding_dismissed_at ?? null;
  const tourSeenAt = prefs?.tour_seen_at ?? null;
  // Mirrors deriveOnboarding's eligibility so the extra read is skipped for
  // vendors who will never see the checklist.
  const eligible = dismissedAt === null && (tourSeenAt === null || !hasConfig);

  // Step 3 is derived: any confirmed payment at all, not just this month's.
  const { data: confirmedRows } = eligible
    ? await supabase
        .from("transactions")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("status", "confirmed")
        .limit(1)
    : { data: null };

  // tour_seen_at is deliberately not written on Home: it only marks vendors who
  // finished the retired tour, so stamping it on first visit would hide the
  // checklist from every new vendor.
  return deriveOnboarding({
    hasConfig,
    qrPreviewedAt: prefs?.qr_previewed_at ?? null,
    hasConfirmedPayment: (confirmedRows?.length ?? 0) > 0,
    dismissedAt,
    tourSeenAt,
  });
}

export default async function DashboardPage() {
  const { supabase, user } = await getVendorSession("/dashboard");

  // Singapore has no DST, so the first of the month is a fixed +08:00 offset.
  const monthStartIso = new Date(
    `${sgtDate(new Date().toISOString()).slice(0, 7)}-01T00:00:00+08:00`,
  ).toISOString();

  const todayStartIso = new Date(
    `${sgtDate(new Date().toISOString())}T00:00:00+08:00`,
  ).toISOString();

  const [config, toConfirm, month, today, recent, { data: prefs }] =
    await Promise.all([
      getConfig(),
      claimedTxSummary(user.id),
      confirmedSince(user.id, monthStartIso),
      confirmedSince(user.id, todayStartIso),
      queryTransactions(user.id, { page: 1, pageSize: 5 }),
      supabase
        .from("vendor_prefs")
        .select("tour_seen_at, onboarding_dismissed_at, qr_previewed_at")
        .eq("vendor_id", user.id)
        .maybeSingle(),
    ]);

  // The ledger only honours `q` for paid plans, so Free rows link unfiltered.
  const isPaid = isPaidPlan(await readVendorPlan(supabase, user.id));

  const onboarding = await loadOnboarding(
    supabase,
    user.id,
    config !== null,
    prefs,
  );

  if (!config) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader responsive title="Home" />
        <OnboardingChecklist state={onboarding} />
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
      <PageHeader responsive title="Home" />

      <OnboardingChecklist state={onboarding} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Confirmed today"
          value={formatMoney(today.cents)}
          caption={`${today.count} payment${today.count === 1 ? "" : "s"}`}
        />

        <StatCard
          label="Waiting for you to confirm"
          value={formatMoney(toConfirm.cents)}
          caption={
            toConfirm.count === 0
              ? "Nothing to confirm right now."
              : `${waitingNoun} marked paid by customers`
          }
        />

        <div data-tour="tx-count">
          <StatCard
            label="Confirmed this month"
            value={formatMoney(month.cents)}
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

      <section className="mt-8" aria-labelledby="recent-payments">
        <h2
          id="recent-payments"
          className="text-sm font-medium text-muted-foreground"
        >
          Recent payments
        </h2>
        {recent.rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <>
            <ul className="mt-2">
              {recent.rows.map((tx) => (
                <li key={tx.id} className="border-b last:border-b-0">
                  <div className="relative grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-1 py-3">
                    {/* No per-payment page exists yet, so a row opens the ledger (filtered to its reference on paid plans). */}
                    <Link
                      href={
                        isPaid
                          ? `/dashboard/transactions?q=${encodeURIComponent(tx.order_ref)}`
                          : "/dashboard/transactions"
                      }
                      className="min-w-0 truncate font-medium after:absolute after:inset-0"
                    >
                      <Money cents={tx.amount_cents} />
                    </Link>
                    <div className="relative z-10 justify-self-end">
                      <TransactionStatusBadge status={tx.status} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span className="min-w-0 truncate">{tx.kit_slug}</span>
                      <Timestamp value={tx.created_at} variant="date" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/transactions"
              className="mt-2 inline-block text-sm underline underline-offset-4"
            >
              View all payments
            </Link>
          </>
        )}
      </section>

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

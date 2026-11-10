import { vendorStatus, type VendorStatus } from "@/lib/vendor-health";
import type { TxStatus, VendorPlan } from "@/lib/types";
import { MS_PER_DAY, formatCents } from "@/lib/utils";

type VendorActivityMetric = { label: string; value: string };

export type VendorActivity = {
  active: boolean;
  plan: VendorPlan | null;
  status: VendorStatus | null;
  metrics: VendorActivityMetric[];
  lastActivityAt: string | null;
};

export type VAConfig = { plan: VendorPlan; created_at: string };
export type VATransaction = {
  status: TxStatus;
  amount_cents: number;
  created_at: string;
  confirmed_at: string | null;
};
export type VARefund = { created_at: string };

const ATTENTION_WINDOW_DAYS = 30;

/**
 * Pure aggregation behind GET /api/merqo/vendor-activity, once the caller has
 * already resolved the vendor's auth-user id (a 404 for an unknown email is
 * the route's job, not this function's — this only ever runs for a vendor
 * that does exist as a user). `config`/`transactions`/`refunds` are all
 * pre-scoped to this one vendor. `config` is null when the vendor has no
 * `vendor_payment_config` row — "known to this kit but currently inactive".
 *
 * The trailing-30d confirmed-transaction/refund counts reuse the exact same
 * `confirmed_at ?? created_at` windowing `vendor-health.ts`'s
 * `buildVendorHealth` uses, so the `metrics` rows shown to an admin always
 * agree with the `status` classified from those same numbers — no separate
 * windowing rule that could quietly disagree with the health signal.
 */
export function computeVendorActivity(
  config: VAConfig | null,
  transactions: VATransaction[],
  refunds: VARefund[],
  nowMs: number,
): VendorActivity {
  if (!config) {
    return {
      active: false,
      plan: null,
      status: null,
      metrics: [],
      lastActivityAt: null,
    };
  }

  const cutoff30d = nowMs - ATTENTION_WINDOW_DAYS * MS_PER_DAY;
  const confirmed = transactions.filter((t) => t.status === "confirmed");

  let confirmedCount30d = 0;
  let volume30dCents = 0;
  let lastConfirmedAt: string | null = null;
  for (const t of confirmed) {
    const at = t.confirmed_at ?? t.created_at;
    if (!lastConfirmedAt || at > lastConfirmedAt) lastConfirmedAt = at;
    if (Date.parse(at) >= cutoff30d) {
      confirmedCount30d++;
      volume30dCents += t.amount_cents;
    }
  }

  const refundCount30d = refunds.filter(
    (r) => Date.parse(r.created_at) >= cutoff30d,
  ).length;
  const refundRatePct =
    confirmedCount30d > 0 ? (refundCount30d / confirmedCount30d) * 100 : 0;

  let lastActivityAt: string | null = null;
  for (const t of transactions) {
    if (!lastActivityAt || t.created_at > lastActivityAt) {
      lastActivityAt = t.created_at;
    }
  }

  const status = vendorStatus(
    {
      plan: config.plan,
      configCreatedAt: config.created_at,
      confirmedCountEver: confirmed.length,
      lastConfirmedAt,
      confirmedCount30d,
      refundCount30d,
    },
    nowMs,
  );

  return {
    active: true,
    plan: config.plan,
    status,
    metrics: [
      { label: "Transactions (30d)", value: String(confirmedCount30d) },
      { label: "Volume (30d)", value: formatCents(volume30dCents) },
      { label: "Refund rate (30d)", value: `${refundRatePct.toFixed(0)}%` },
    ],
    lastActivityAt,
  };
}

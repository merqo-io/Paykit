import type { TxStatus, VendorPlan } from "@/lib/types";
import { MS_PER_DAY } from "@/lib/utils";

// Mirrors merqo's `metricsPayloadSchema` (../merqo/src/lib/metrics-schema.ts).
// Defined locally rather than imported — cross-repo runtime imports aren't
// available; test/contract/merqo-metrics.contract.test.ts keeps this in
// lockstep with merqo's actual schema.
export type MetricsPayload = {
  product: string;
  generated_at: string;
  revenue_cents_30d: number;
  revenue_cents_all: number;
  gmv_cents_30d: number;
  active_vendors: number;
  orders_7d: number;
  orders_prev_7d: number;
  signups_7d: number;
  pro_vendors: number;
  total_vendors: number;
  pending_upgrade_requests: number;
  funnel: {
    signed_up: number;
    with_booth: number;
    with_order: number;
    pro: number;
  };
};

export type PaykitMetrics = Omit<MetricsPayload, "product" | "generated_at">;

export type PaykitMetricsInput = {
  nowMs: number;
  vendors: { vendor_id: string; plan: VendorPlan; created_at: string }[];
  transactions: {
    vendor_id: string;
    amount_cents: number;
    status: TxStatus;
    created_at: string;
  }[];
};

// Maps paykit's payment-config/transaction domain onto merqo's qkit-shaped
// payload — see this file's README entry for the full per-field mapping.
export function computePaykitMetrics(input: PaykitMetricsInput): PaykitMetrics {
  const { nowMs, vendors, transactions } = input;
  const cutoff7d = nowMs - 7 * MS_PER_DAY;
  const cutoff14d = nowMs - 14 * MS_PER_DAY;
  const cutoff30d = nowMs - 30 * MS_PER_DAY;

  const inWindow = (iso: string, gteMs: number, ltMs?: number) => {
    const t = Date.parse(iso);
    return t >= gteMs && (ltMs === undefined || t < ltMs);
  };

  const confirmed = transactions.filter((t) => t.status === "confirmed");
  const revenue_cents_30d = confirmed
    .filter((t) => inWindow(t.created_at, cutoff30d))
    .reduce((s, t) => s + t.amount_cents, 0);
  const revenue_cents_all = confirmed.reduce((s, t) => s + t.amount_cents, 0);
  const gmv_cents_30d = transactions
    .filter((t) => inWindow(t.created_at, cutoff30d))
    .reduce((s, t) => s + t.amount_cents, 0);

  const orders_7d = transactions.filter((t) =>
    inWindow(t.created_at, cutoff7d),
  ).length;
  const orders_prev_7d = transactions.filter((t) =>
    inWindow(t.created_at, cutoff14d, cutoff7d),
  ).length;

  const signups_7d = vendors.filter((v) =>
    inWindow(v.created_at, cutoff7d),
  ).length;

  const total_vendors = vendors.length;
  const pro_vendors = vendors.filter((v) => v.plan === "pro").length;

  const vendorIdsWithTransactions = new Set(
    transactions.map((t) => t.vendor_id),
  );
  const with_order = vendors.filter((v) =>
    vendorIdsWithTransactions.has(v.vendor_id),
  ).length;

  return {
    revenue_cents_30d,
    revenue_cents_all,
    gmv_cents_30d,
    active_vendors: with_order,
    orders_7d,
    orders_prev_7d,
    signups_7d,
    pro_vendors,
    total_vendors,
    pending_upgrade_requests: 0,
    funnel: {
      signed_up: total_vendors,
      with_booth: total_vendors,
      with_order,
      pro: pro_vendors,
    },
  };
}

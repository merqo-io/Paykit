import type { TxStatus, VendorPlan } from "@/lib/types";
import { MS_PER_DAY } from "@/lib/utils";

/**
 * Per-vendor health as a small set of banded statuses — not a synthetic 0-100
 * score. paykit has no login/engagement telemetry beyond transactions and
 * refunds, so a numeric score would be false precision; a banded status the
 * admin can act on is more honest. First matching rule wins, most-urgent
 * first. Adapted from qkit's own `admin-vendor-health.ts` status vocabulary/
 * rank convention — the signals themselves (refund rate, confirmed-
 * transaction recency) are paykit's own domain, not ported.
 */
export type VendorStatus =
  // a real refund-rate anomaly in the trailing 30 days
  | "attention"
  // has a payment config (or is Pro) with zero confirmed transactions
  | "stuck"
  // active before, quiet for 14+ days now
  | "quiet"
  // payment config created within the last 3 days
  | "new"
  // a confirmed transaction within the last 14 days
  | "healthy";

const NEW_DAYS = 3;
const STUCK_DAYS = 3;
const QUIET_DAYS = 14;
const ATTENTION_WINDOW_DAYS = 30;

/** ≥3 refunds in the trailing 30 days is a real anomaly on its own. */
const ATTENTION_MIN_REFUNDS = 3;
/** Refund/confirmed ratio only applies once there's a real sample to divide by. */
const ATTENTION_MIN_SAMPLE = 5;
/** Refund/confirmed ratio above this in the trailing 30 days is a real anomaly. */
const ATTENTION_RATIO = 0.2;

const RANK: Record<VendorStatus, number> = {
  attention: 0,
  stuck: 1,
  quiet: 2,
  new: 3,
  healthy: 4,
};

/** Triage sort key for a status — lower is more urgent. */
export function statusRank(status: VendorStatus): number {
  return RANK[status];
}

function ageMs(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? nowMs - t : 0;
}

type Signals = {
  plan: VendorPlan;
  configCreatedAt: string;
  /** Confirmed transactions ever, for this vendor. */
  confirmedCountEver: number;
  /** Most recent confirmed transaction, or null if it's never happened. */
  lastConfirmedAt: string | null;
  /** Confirmed transactions in the trailing 30 days. */
  confirmedCount30d: number;
  /** Refunds filed in the trailing 30 days. */
  refundCount30d: number;
};

/**
 * A real refund-rate anomaly: either an absolute count (≥3 refunds in 30d,
 * regardless of volume) or a rate (>20% of confirmed transactions refunded
 * in 30d) — the rate check only applies once there's a minimum sample
 * (≥5 confirmed transactions in 30d), so a brand-new vendor with 1 refund out
 * of 1 transaction doesn't false-positive.
 */
function hasRefundAnomaly(s: Signals): boolean {
  if (s.refundCount30d >= ATTENTION_MIN_REFUNDS) return true;
  if (s.confirmedCount30d < ATTENTION_MIN_SAMPLE) return false;
  return s.refundCount30d / s.confirmedCount30d > ATTENTION_RATIO;
}

/** Classify one vendor from its rolled-up signals. First match wins. */
export function vendorStatus(s: Signals, nowMs: number): VendorStatus {
  if (hasRefundAnomaly(s)) return "attention";

  const configAge = ageMs(s.configCreatedAt, nowMs);
  if (
    (s.confirmedCountEver === 0 && configAge >= STUCK_DAYS * MS_PER_DAY) ||
    (s.plan === "pro" && s.confirmedCountEver === 0)
  ) {
    return "stuck";
  }

  if (
    s.lastConfirmedAt &&
    nowMs - Date.parse(s.lastConfirmedAt) <= QUIET_DAYS * MS_PER_DAY
  )
    return "healthy";

  if (configAge < NEW_DAYS * MS_PER_DAY) return "new";

  return "quiet";
}

export type VendorLite = {
  id: string;
  plan: VendorPlan;
  configCreatedAt: string;
};
export type TransactionLite = {
  id: string;
  vendor_id: string;
  status: TxStatus;
  created_at: string;
  confirmed_at: string | null;
};
export type RefundLite = {
  transaction_id: string;
  created_at: string;
};

export type VendorHealthRow = {
  status: VendorStatus;
  confirmedCount30d: number;
  refundCount30d: number;
  lastConfirmedAt: string | null;
};

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function rollUpConfirmed(transactions: TransactionLite[], cutoff30d: number) {
  const txVendor = new Map<string, string>();
  const confirmedCountEver = new Map<string, number>();
  const confirmedCount30d = new Map<string, number>();
  const lastConfirmedAt = new Map<string, string>();
  for (const t of transactions) {
    txVendor.set(t.id, t.vendor_id);
    if (t.status !== "confirmed") continue;
    const at = t.confirmed_at ?? t.created_at;
    bump(confirmedCountEver, t.vendor_id);
    if (Date.parse(at) >= cutoff30d) bump(confirmedCount30d, t.vendor_id);
    const cur = lastConfirmedAt.get(t.vendor_id);
    if (!cur || at > cur) lastConfirmedAt.set(t.vendor_id, at);
  }
  return { txVendor, confirmedCountEver, confirmedCount30d, lastConfirmedAt };
}

/**
 * Roll raw admin-overview rows into a per-vendor health map. Pure: no DB, no
 * clock. Refunds are keyed to their vendor via the transaction map (`refunds`
 * has no `vendor_id` column of its own). O(vendors + transactions + refunds).
 */
export function buildVendorHealth(
  vendors: VendorLite[],
  transactions: TransactionLite[],
  refunds: RefundLite[],
  nowMs: number,
): Map<string, VendorHealthRow> {
  const cutoff30d = nowMs - ATTENTION_WINDOW_DAYS * MS_PER_DAY;
  const { txVendor, confirmedCountEver, confirmedCount30d, lastConfirmedAt } =
    rollUpConfirmed(transactions, cutoff30d);

  const refundCount30d = new Map<string, number>();
  for (const r of refunds) {
    if (Date.parse(r.created_at) < cutoff30d) continue;
    const vid = txVendor.get(r.transaction_id);
    if (!vid) continue;
    bump(refundCount30d, vid);
  }

  const out = new Map<string, VendorHealthRow>();
  for (const v of vendors) {
    const signals: Signals = {
      plan: v.plan,
      configCreatedAt: v.configCreatedAt,
      confirmedCountEver: confirmedCountEver.get(v.id) ?? 0,
      lastConfirmedAt: lastConfirmedAt.get(v.id) ?? null,
      confirmedCount30d: confirmedCount30d.get(v.id) ?? 0,
      refundCount30d: refundCount30d.get(v.id) ?? 0,
    };
    out.set(v.id, {
      status: vendorStatus(signals, nowMs),
      confirmedCount30d: signals.confirmedCount30d,
      refundCount30d: signals.refundCount30d,
      lastConfirmedAt: signals.lastConfirmedAt,
    });
  }
  return out;
}

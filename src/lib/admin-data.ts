import { readAllRows, readAllRowsResult } from "@/lib/read-all-rows";
import { createServiceClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/list-all-users";
import { readAllVendorPlans } from "@/lib/vendor-entitlement";
import {
  buildVendorHealth,
  statusRank,
  type VendorStatus,
} from "@/lib/vendor-health";
import { PER_ROUTE_LIMIT } from "@/lib/rate-limit";
import { MS_PER_DAY, MS_PER_HOUR } from "@/lib/utils";
import type {
  Json,
  PaymentConfigKind,
  TxStatus,
  VendorPlan,
} from "@/lib/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type PlatformTotals = {
  vendors: number;
  free_vendors: number;
  pro_vendors: number;
  transactions: number;
  confirmed_transactions: number;
  confirmed_volume_cents: number;
  /** Confirmed transactions in the trailing 7 days, and the prior 7 days (for a delta). */
  confirmed_7d: number;
  confirmed_prev_7d: number;
  /** Confirmed volume in the trailing 30 days, and the prior 30 days (for a delta). */
  confirmed_volume_cents_30d: number;
  confirmed_volume_cents_prev_30d: number;
  /** Refunds filed in the trailing 30 days — count and total amount. */
  refund_count_30d: number;
  refund_volume_cents_30d: number;
};

export type SecurityStats = {
  /** paykit.auth_failures rows in the trailing 24 hours. */
  failed_auth_24h: number;
  /** Distinct kit_slugs that hit the per-route rate limit in the trailing 24 hours. */
  rate_limited_kits_24h: number;
};

export type ActivityRow = {
  id: string;
  vendor_id: string;
  email: string | null;
  kit_slug: string;
  amount_cents: number;
  status: TxStatus;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  admin_id: string;
  email: string | null;
  action: string;
  target_id: string | null;
  detail: Json;
  created_at: string;
};

export type VendorRow = {
  vendor_id: string;
  email: string | null;
  plan: VendorPlan;
  kind: PaymentConfigKind;
  payee_name: string | null;
  label: string | null;
  transaction_count: number;
  created_at: string;
  status: VendorStatus;
};

// The admin console spans every vendor, so it reads with the service-role
// client (RLS-exempt) rather than widening the per-vendor policies. Vendor
// identity lives on auth.users, resolved to email via the admin API — the
// primary "who is this vendor" identity, since payee_name is null for
// `kind='pointer'` rows (see the vendor_payment_config_kind_shape check in
// 0003_paykit_multi_method.sql) and can't stand in for every vendor alone.
async function emailByUserId(
  supabase: ServiceClient,
): Promise<Map<string, string | null>> {
  const { data } = await listAllUsers(supabase);
  return new Map((data?.users ?? []).map((u) => [u.id, u.email ?? null]));
}

/** Platform-wide totals for the overview stat tiles. */
export async function platformTotals(): Promise<PlatformTotals> {
  const supabase = await createServiceClient();
  const [vendors, transactions, refunds, plansRes] = await Promise.all([
    readAllRows((from, to) =>
      supabase
        .from("vendor_payment_config")
        .select("vendor_id")
        .order("vendor_id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("id, status, amount_cents, created_at, confirmed_at")
        .order("id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      supabase
        .from("refunds")
        .select("refunded_amount_cents, created_at")
        .order("id")
        .range(from, to),
    ),
    readAllVendorPlans(supabase),
  ]);
  if (plansRes.error) throw new Error(`platformTotals: ${plansRes.error}`);
  const confirmed = transactions.filter((t) => t.status === "confirmed");

  const now = Date.now();
  const cutoff7d = now - 7 * MS_PER_DAY;
  const cutoff14d = now - 14 * MS_PER_DAY;
  const cutoff30d = now - 30 * MS_PER_DAY;
  const cutoff60d = now - 60 * MS_PER_DAY;
  const confirmedAt = (t: (typeof confirmed)[number]) =>
    Date.parse(t.confirmed_at ?? t.created_at);

  return {
    vendors: vendors.length,
    free_vendors: vendors.filter(
      (v) => (plansRes.plans.get(v.vendor_id) ?? "free") === "free",
    ).length,
    pro_vendors: vendors.filter((v) => plansRes.plans.get(v.vendor_id) === "pro")
      .length,
    transactions: transactions.length,
    confirmed_transactions: confirmed.length,
    confirmed_volume_cents: confirmed.reduce(
      (sum, t) => sum + t.amount_cents,
      0,
    ),
    confirmed_7d: confirmed.filter((t) => confirmedAt(t) >= cutoff7d).length,
    confirmed_prev_7d: confirmed.filter(
      (t) => confirmedAt(t) >= cutoff14d && confirmedAt(t) < cutoff7d,
    ).length,
    confirmed_volume_cents_30d: confirmed
      .filter((t) => confirmedAt(t) >= cutoff30d)
      .reduce((sum, t) => sum + t.amount_cents, 0),
    confirmed_volume_cents_prev_30d: confirmed
      .filter((t) => confirmedAt(t) >= cutoff60d && confirmedAt(t) < cutoff30d)
      .reduce((sum, t) => sum + t.amount_cents, 0),
    refund_count_30d: refunds.filter(
      (r) => Date.parse(r.created_at) >= cutoff30d,
    ).length,
    refund_volume_cents_30d: refunds
      .filter((r) => Date.parse(r.created_at) >= cutoff30d)
      .reduce((sum, r) => sum + r.refunded_amount_cents, 0),
  };
}

/**
 * Failed bearer-auth attempts (`auth_failures`) and rate-limit pressure
 * (`rate_limits` windows at the per-route limit), for the overview page.
 * `key` is `${route}:${kitSlug}:${ip}` — the ip segment is whatever remains
 * after the first two colons, safe even for a colon-bearing IPv6 address.
 */
export async function securityStats(): Promise<SecurityStats> {
  const supabase = await createServiceClient();
  const cutoff24h = new Date(Date.now() - 24 * MS_PER_HOUR).toISOString();

  const [authRes, rlRes] = await Promise.all([
    supabase
      .from("auth_failures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoff24h),
    readAllRowsResult((from, to) =>
      supabase
        .from("rate_limits")
        .select("key")
        .gte("window_start", cutoff24h)
        .gte("count", PER_ROUTE_LIMIT)
        .order("key")
        .range(from, to),
    ),
  ]);
  if (authRes.error) throw new Error(`securityStats: ${authRes.error.message}`);
  if (rlRes.error) throw new Error(`securityStats: ${rlRes.error.message}`);

  const kitSlugs = new Set(
    (rlRes.data ?? []).map((row) => row.key.split(":")[1]).filter(Boolean),
  );

  return {
    failed_auth_24h: authRes.count ?? 0,
    rate_limited_kits_24h: kitSlugs.size,
  };
}

/** The most recent transactions across every vendor, identity resolved to email. */
export async function recentActivity(limit = 15): Promise<ActivityRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, vendor_id, kit_slug, amount_cents, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recentActivity: ${error.message}`);

  const emails = await emailByUserId(supabase);
  return (data ?? []).map((tx) => ({
    id: tx.id,
    vendor_id: tx.vendor_id,
    email: emails.get(tx.vendor_id) ?? null,
    kit_slug: tx.kit_slug,
    amount_cents: tx.amount_cents,
    status: tx.status,
    created_at: tx.created_at,
  }));
}

/**
 * Every vendor with a payment config, their transaction count, resolved
 * email, and triage status — for the admin Vendors table. Aggregation is
 * done in TS over three flat reads (vendor_payment_config, transactions,
 * refunds) to avoid multi-join SQL, matching admin-data's pattern in the
 * sibling kits. Sorted most-urgent first (`vendor-health.ts`'s
 * `statusRank`), ties keeping the newest signup on top — qkit's own
 * admin-vendors convention.
 */
export async function listVendors(): Promise<VendorRow[]> {
  const supabase = await createServiceClient();
  const [vendors, transactions, refunds, plansRes] = await Promise.all([
    readAllRows((from, to) =>
      supabase
        .from("vendor_payment_config")
        .select("vendor_id, kind, payee_name, label, created_at")
        .order("vendor_id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("id, vendor_id, status, created_at, confirmed_at")
        .order("id")
        .range(from, to),
    ),
    readAllRows((from, to) =>
      supabase
        .from("refunds")
        .select("transaction_id, created_at")
        .order("id")
        .range(from, to),
    ),
    readAllVendorPlans(supabase),
  ]);
  if (plansRes.error) throw new Error(`listVendors: ${plansRes.error}`);
  const emails = await emailByUserId(supabase);

  const txCounts = new Map<string, number>();
  for (const t of transactions) {
    txCounts.set(t.vendor_id, (txCounts.get(t.vendor_id) ?? 0) + 1);
  }

  const now = Date.now();
  const health = buildVendorHealth(
    vendors.map((v) => ({
      id: v.vendor_id,
      plan: plansRes.plans.get(v.vendor_id) ?? "free",
      configCreatedAt: v.created_at,
    })),
    transactions,
    refunds,
    now,
  );

  return vendors
    .map((v) => ({
      vendor_id: v.vendor_id,
      email: emails.get(v.vendor_id) ?? null,
      plan: plansRes.plans.get(v.vendor_id) ?? "free",
      kind: v.kind,
      payee_name: v.payee_name,
      label: v.label,
      transaction_count: txCounts.get(v.vendor_id) ?? 0,
      created_at: v.created_at,
      status: health.get(v.vendor_id)?.status ?? "new",
    }))
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        b.created_at.localeCompare(a.created_at),
    );
}

/**
 * Most recent `admin_audit` rows across every admin- and vendor-initiated
 * action, identity resolved to email the same way `recentActivity` resolves
 * a vendor — `admin_id` is any `auth.users` id (see `recordAudit`'s own
 * comment), not necessarily an `admins` member.
 */
export async function auditLog(limit = 100): Promise<AuditLogRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("admin_audit")
    .select("id, admin_id, action, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`auditLog: ${error.message}`);

  const emails = await emailByUserId(supabase);
  return (data ?? []).map((row) => ({
    id: row.id,
    admin_id: row.admin_id,
    email: emails.get(row.admin_id) ?? null,
    action: row.action,
    target_id: row.target_id,
    detail: row.detail,
    created_at: row.created_at,
  }));
}

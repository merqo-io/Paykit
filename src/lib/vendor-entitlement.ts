import { readAllRowsResult } from "@/lib/read-all-rows";
import type {
  createServerClient,
  createServiceClient,
} from "@/lib/supabase/server";
import type { VendorPlan } from "@/lib/types";

type Client =
  | Awaited<ReturnType<typeof createServerClient>>
  | Awaited<ReturnType<typeof createServiceClient>>;

export type EntitlementRow = {
  tier: "free" | "paid";
  valid_until: string | null;
  event_pass_starts_at: string | null;
  event_pass_ends_at: string | null;
};

const COLUMNS =
  "tier, valid_until, event_pass_starts_at, event_pass_ends_at" as const;

/**
 * Whether Pro-only features are allowed: paid and unexpired, or an event pass
 * running. Merqo has no cron, so a lapse applies here by comparing against
 * `now` rather than waiting for a push. Mirrors the SQL `vendor_is_entitled`.
 * A missing row is free. The result keeps the free/pro vocabulary of
 * vendor-facing responses, with paid mapped to pro.
 */
export function resolvePlan(
  row: EntitlementRow | null,
  now: Date = new Date(),
): VendorPlan {
  if (!row) return "free";
  const nowMs = now.getTime();
  const paid =
    row.tier === "paid" &&
    (row.valid_until === null || Date.parse(row.valid_until) > nowMs);
  const passRunning =
    row.event_pass_starts_at !== null &&
    row.event_pass_ends_at !== null &&
    Date.parse(row.event_pass_starts_at) <= nowMs &&
    nowMs < Date.parse(row.event_pass_ends_at);
  return paid || passRunning ? "pro" : "free";
}

/**
 * A single vendor's plan from the entitlement cache. `null` when the read
 * fails, so callers decide their own fail-closed behaviour.
 */
export async function readVendorPlan(
  supabase: Client,
  vendorId: string,
  now: Date = new Date(),
): Promise<VendorPlan | null> {
  const { data, error } = await supabase
    .from("vendor_entitlements")
    .select(COLUMNS)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (error) {
    console.error("readVendorPlan failed", error.message);
    return null;
  }
  return resolvePlan(data, now);
}

/**
 * Plan for every vendor that has a cache row, keyed by vendor id. Vendors
 * without a row are absent and read as free. Service-role callers only: the
 * own-row RLS policy hides other vendors from a signed-in client.
 */
export async function readAllVendorPlans(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  now: Date = new Date(),
): Promise<{ plans: Map<string, VendorPlan>; error: string | null }> {
  const res = await readAllRowsResult((from, to) =>
    supabase
      .from("vendor_entitlements")
      .select(`vendor_id, ${COLUMNS}`)
      .order("vendor_id")
      .range(from, to),
  );
  if (res.error) return { plans: new Map(), error: res.error.message };
  const plans = new Map<string, VendorPlan>();
  for (const row of res.data ?? [])
    plans.set(row.vendor_id, resolvePlan(row, now));
  return { plans, error: null };
}

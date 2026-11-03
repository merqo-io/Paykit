import { readAllRowsResult } from "@/lib/read-all-rows";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { bearerOk } from "@/lib/merqo-auth";
import { computePaykitMetrics } from "@/lib/metrics";
import type { TxStatus } from "@/lib/types";
import { readAllVendorPlans } from "@/lib/vendor-entitlement";

export const revalidate = 0;

export async function GET(request: Request) {
  if (!bearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Independent reads — issue them concurrently so endpoint latency is
  // one round-trip, not the sum of them.
  const [vendorsRes, transactionsRes, plansRes] = await Promise.all([
    readAllRowsResult((from, to) =>
      supabase
        .from("vendor_payment_config")
        .select("vendor_id, created_at")
        .order("vendor_id")
        .range(from, to),
    ),
    readAllRowsResult((from, to) =>
      supabase
        .from("transactions")
        .select("vendor_id, amount_cents, status, created_at")
        .order("id")
        .range(from, to),
    ),
    readAllVendorPlans(supabase),
  ]);

  if (plansRes.error) {
    console.error("merqo metrics: read failed", plansRes.error);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  for (const r of [vendorsRes, transactionsRes]) {
    if (r.error) {
      console.error("merqo metrics: read failed", r.error.message);
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 503 },
      );
    }
  }

  const metrics = computePaykitMetrics({
    nowMs: Date.now(),
    vendors: ((vendorsRes.data ?? []) as {
      vendor_id: string;
      created_at: string;
    }[]).map((v) => ({
      ...v,
      plan: plansRes.plans.get(v.vendor_id) ?? "free",
    })),
    transactions: (transactionsRes.data ?? []) as {
      vendor_id: string;
      amount_cents: number;
      status: TxStatus;
      created_at: string;
    }[],
  });

  return NextResponse.json({
    product: "paykit",
    generated_at: new Date().toISOString(),
    ...metrics,
  });
}

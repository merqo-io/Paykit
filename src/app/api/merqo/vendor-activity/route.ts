import { readAllRowsResult } from "@/lib/read-all-rows";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/list-all-users";
import { bearerOk } from "@/lib/merqo-auth";
import { computeVendorActivity } from "@/lib/merqo-vendor-activity";
import type { TxStatus, VendorPlan } from "@/lib/types";

export const revalidate = 0;

const querySchema = z.object({ email: z.email() });

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type ActivityTransaction = {
  id: string;
  status: TxStatus;
  amount_cents: number;
  created_at: string;
  confirmed_at: string | null;
};

function upstreamUnavailable(message: string) {
  console.error("paykit vendor-activity: read failed", message);
  return NextResponse.json({ error: "Upstream unavailable" }, { status: 503 });
}

async function readConfigAndTransactions(
  supabase: ServiceClient,
  userId: string,
) {
  const [configRes, transactionsRes] = await Promise.all([
    supabase
      .from("vendor_payment_config")
      .select("plan, created_at")
      .eq("vendor_id", userId)
      .maybeSingle(),
    readAllRowsResult((from, to) =>
      supabase
        .from("transactions")
        .select("id, status, amount_cents, created_at, confirmed_at")
        .eq("vendor_id", userId)
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    error: configRes.error?.message ?? transactionsRes.error?.message ?? null,
    config: configRes.data as { plan: VendorPlan; created_at: string } | null,
    transactions: (transactionsRes.data ?? []) as ActivityTransaction[],
  };
}

async function readRefunds(supabase: ServiceClient, txIds: string[]) {
  const refunds: { created_at: string }[] = [];
  for (let offset = 0; offset < txIds.length; offset += 100) {
    const res = await readAllRowsResult((from, to) =>
      supabase
        .from("refunds")
        .select("created_at")
        .in("transaction_id", txIds.slice(offset, offset + 100))
        .order("id")
        .range(from, to),
    );
    if (res.error) return { error: res.error.message, refunds };
    refunds.push(...(res.data ?? []));
  }
  return { error: null, refunds };
}

export async function GET(request: Request) {
  if (!bearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    email: searchParams.get("email") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const usersRes = await listAllUsers(supabase);
  if (usersRes.error) {
    return upstreamUnavailable(usersRes.error.message);
  }

  const key = parsed.data.email.toLowerCase();
  const user = (usersRes.data?.users ?? []).find(
    (u) => u.email?.toLowerCase() === key,
  );
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = await readConfigAndTransactions(supabase, user.id);
  if (base.error) return upstreamUnavailable(base.error);

  // refunds has no vendor_id of its own, so scope it via this vendor's own
  // transaction ids.
  const refundsRes = await readRefunds(
    supabase,
    base.transactions.map((t) => t.id),
  );
  if (refundsRes.error) return upstreamUnavailable(refundsRes.error);
  const { config, transactions } = base;
  const refunds = refundsRes.refunds;

  const payload = computeVendorActivity(
    config,
    transactions,
    refunds,
    Date.now(),
  );
  return NextResponse.json(payload);
}

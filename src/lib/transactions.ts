import { readAllRows } from "@/lib/read-all-rows";
import { createServerClient } from "@/lib/supabase/server";
import type { Transaction } from "@/lib/types";
import { TRANSACTION_COLUMNS } from "@/lib/columns";

/** `since` hides older rows from the list without touching them. */
export async function listTransactions(
  vendorId: string,
  since?: string,
): Promise<Transaction[]> {
  const supabase = await createServerClient();
  const base = supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("vendor_id", vendorId);
  const { data, error } = await (since ? base.gte("created_at", since) : base)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listTransactions failed", error.message);
    return [];
  }
  return data ?? [];
}

export async function getTransaction(
  vendorId: string,
  transactionId: string,
): Promise<Transaction | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("vendor_id", vendorId)
    .eq("id", transactionId)
    .maybeSingle();
  if (error) {
    console.error("getTransaction failed", error.message);
    return null;
  }
  return data;
}

export async function txCountThisMonth(vendorId: string): Promise<number> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("tx_count_this_month", {
    p_vendor: vendorId,
  });
  if (error) {
    console.error("txCountThisMonth failed", error.message);
    return 0;
  }
  return data ?? 0;
}

/** Payments a customer has marked paid that the vendor has not yet confirmed: how many and the SGD cents they add up to. */
export async function claimedTxSummary(
  vendorId: string,
): Promise<{ count: number; cents: number }> {
  const supabase = await createServerClient();
  try {
    const rows = await readAllRows<{ amount_cents: number }>((from, to) =>
      supabase
        .from("transactions")
        .select("amount_cents")
        .eq("vendor_id", vendorId)
        .eq("status", "claimed")
        .order("id")
        .range(from, to),
    );
    return {
      count: rows.length,
      cents: rows.reduce((sum, row) => sum + row.amount_cents, 0),
    };
  } catch (error) {
    console.error("claimedTxSummary failed", error);
    return { count: 0, cents: 0 };
  }
}

/** Payments confirmed at or after `sinceIso` (by confirmation time, not creation), as a count and SGD cents from the same rows. */
export async function confirmedSince(
  vendorId: string,
  sinceIso: string,
): Promise<{ count: number; cents: number }> {
  const supabase = await createServerClient();
  try {
    const rows = await readAllRows<{ amount_cents: number }>((from, to) =>
      supabase
        .from("transactions")
        .select("amount_cents")
        .eq("vendor_id", vendorId)
        .eq("status", "confirmed")
        .gte("confirmed_at", sinceIso)
        .order("id")
        .range(from, to),
    );
    return {
      count: rows.length,
      cents: rows.reduce((sum, row) => sum + row.amount_cents, 0),
    };
  } catch (error) {
    console.error("confirmedSince failed", error);
    return { count: 0, cents: 0 };
  }
}

/** Complete vendor-scoped records for reports, separate from the recent-items UI. */
export async function listAllTransactions(
  vendorId: string,
): Promise<Transaction[]> {
  const supabase = await createServerClient();
  return readAllRows((from, to) =>
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("vendor_id", vendorId)
      .order("id")
      .range(from, to),
  );
}

/** How many of the vendor's transactions predate `cutoff`; counted, never fetched. */
export async function countTransactionsBefore(
  vendorId: string,
  cutoff: string,
): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .lt("created_at", cutoff);
  if (error) {
    console.error("countTransactionsBefore failed", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Confirmed transactions created in [startIso, endIso). */
export async function listConfirmedBetween(
  vendorId: string,
  startIso: string,
  endIso: string,
): Promise<Transaction[]> {
  const supabase = await createServerClient();
  return readAllRows((from, to) =>
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("vendor_id", vendorId)
      .eq("status", "confirmed")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("id")
      .range(from, to),
  );
}

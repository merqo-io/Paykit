import { readAllRows } from "@/lib/read-all-rows";
import { createServerClient } from "@/lib/supabase/server";
import type { Transaction, TxStatus } from "@/lib/types";
import { TRANSACTION_COLUMNS } from "@/lib/columns";

export type TransactionQuery = {
  /** Inclusive lower bound on created_at; Free callers pass the cutoff here. */
  gteIso?: string;
  /** Exclusive upper bound on created_at. */
  ltIso?: string;
  status?: TxStatus;
  search?: string;
  page: number;
  pageSize: number;
};

export type TransactionPage = {
  rows: Transaction[];
  /** Rows matching every filter, across all pages. */
  total: number;
  failed: boolean;
};

/**
 * Strips characters that carry meaning in a PostgREST `or` filter, then
 * escapes the ILIKE wildcards so `%` and `_` in an order ref match literally.
 */
export function searchTerm(raw: string): string {
  return raw
    .replace(/[,()*\\"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[%_]/g, (c) => `\\${c}`);
}

/** PostgREST answers an out-of-range `.range()` with this code (HTTP 416). */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/** One page of the vendor's ledger, newest first. RLS still scopes rows to the vendor. */
export async function queryTransactions(
  vendorId: string,
  query: TransactionQuery,
): Promise<TransactionPage> {
  const supabase = await createServerClient();
  const term = query.search ? searchTerm(query.search) : "";
  const page = (rangeFrom: number, rangeTo: number) => {
    // Exact counts are fine at current per-vendor volume; revisit if one
    // vendor's ledger grows large enough to make count(*) slow.
    let q = supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS, { count: "exact" })
      .eq("vendor_id", vendorId);
    if (query.gteIso) q = q.gte("created_at", query.gteIso);
    if (query.ltIso) q = q.lt("created_at", query.ltIso);
    if (query.status) q = q.eq("status", query.status);
    if (term) {
      q = q.or(`order_ref.ilike.%${term}%,pay_title.ilike.%${term}%`);
    }
    return q
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(rangeFrom, rangeTo);
  };
  const from = (query.page - 1) * query.pageSize;
  let { data, count, error } = await page(from, from + query.pageSize - 1);
  if (error?.code === RANGE_NOT_SATISFIABLE) {
    // A page past the end is an empty page, not a failure; a one-row probe
    // recovers the total so the caller can send the vendor to the last page.
    ({ count, error } = await page(0, 0));
    data = [];
  }
  if (error) {
    console.error("queryTransactions failed", error.message);
    return { rows: [], total: 0, failed: true };
  }
  return { rows: data ?? [], total: count ?? 0, failed: false };
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

/** Count of the vendor's transactions a customer has marked paid and the vendor has not yet confirmed. */
export async function claimedTxCount(vendorId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .eq("status", "claimed");
  if (error) {
    console.error("claimedTxCount failed", error.message);
    return 0;
  }
  return count ?? 0;
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

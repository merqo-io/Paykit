import { readAllRows } from "@/lib/read-all-rows";
import { createServerClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";
import { BOOKING_COLUMNS } from "@/lib/columns";

export async function getBooking(
  vendorId: string,
  bookingId: string,
): Promise<Booking | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("vendor_id", vendorId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    console.error("getBooking failed", error.message);
    return null;
  }
  return data;
}

/** Complete vendor-scoped records for reports, separate from the recent-items UI. */
export async function listAllBookings(vendorId: string): Promise<Booking[]> {
  const supabase = await createServerClient();
  return readAllRows((from, to) =>
    supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("vendor_id", vendorId)
      .order("id")
      .range(from, to),
  );
}

export type BookingSearch = {
  q: string;
  status: Booking["status"] | null;
  page: number;
  pageSize: number;
};

// Search text goes into a PostgREST `or()` filter, where `,` `(` `)` split
// clauses and `%` `_` `\` are LIKE wildcards; strip them so input can't alter the filter.
function sanitizeSearch(q: string): string {
  return q
    .replace(/[,()%_\\*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type BookingSearchResult =
  { ok: true; rows: Booking[]; total: number } | { ok: false };

// PostgREST answers a range past the end with 416 / PGRST103; that is an empty
// page, not a failure, and the caller still needs the real total to redirect.
const RANGE_NOT_SATISFIABLE = "PGRST103";

/** Filtered, paginated bookings plus the matching row count. RLS still scopes rows. */
export async function searchBookings(
  vendorId: string,
  { q, status, page, pageSize }: BookingSearch,
): Promise<BookingSearchResult> {
  const supabase = await createServerClient();
  const term = sanitizeSearch(q);
  const run = (from: number, to: number) => {
    let query = supabase
      .from("bookings")
      .select(BOOKING_COLUMNS, { count: "exact" })
      .eq("vendor_id", vendorId);
    if (status) query = query.eq("status", status);
    if (term) {
      query = query.or(
        `customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
      );
    }
    return query.order("created_at", { ascending: false }).range(from, to);
  };
  const from = (page - 1) * pageSize;
  const { data, count, error } = await run(from, from + pageSize - 1);
  if (!error) return { ok: true, rows: data ?? [], total: count ?? 0 };
  if (error.code === RANGE_NOT_SATISFIABLE) {
    const first = await run(0, 0);
    if (!first.error) return { ok: true, rows: [], total: first.count ?? 0 };
    console.error("searchBookings failed", first.error.message);
    return { ok: false };
  }
  console.error("searchBookings failed", error.message);
  return { ok: false };
}

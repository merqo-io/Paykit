import { readAllRows } from "@/lib/read-all-rows";
import { createServerClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";
import { BOOKING_COLUMNS } from "@/lib/columns";

export async function listBookings(vendorId: string): Promise<Booking[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listBookings failed", error.message);
    return [];
  }
  return data ?? [];
}

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

/** Filtered, paginated bookings plus the matching row count. RLS still scopes rows. */
export async function searchBookings(
  vendorId: string,
  { q, status, page, pageSize }: BookingSearch,
): Promise<{ rows: Booking[]; total: number }> {
  const supabase = await createServerClient();
  let query = supabase
    .from("bookings")
    .select(BOOKING_COLUMNS, { count: "exact" })
    .eq("vendor_id", vendorId);
  if (status) query = query.eq("status", status);
  const term = sanitizeSearch(q);
  if (term) {
    query = query.or(
      `customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) {
    console.error("searchBookings failed", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: data ?? [], total: count ?? 0 };
}

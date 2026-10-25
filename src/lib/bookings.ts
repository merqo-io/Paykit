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

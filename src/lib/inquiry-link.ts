import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Marks an inquiry converted once its booking exists. Service role, because
 * `booking_id` has no vendor grant; both rows are matched on the vendor, so
 * an inquiry can only ever point at its own vendor's booking.
 */
export async function linkInquiryToBooking(
  vendorId: string,
  inquiryId: string,
  bookingId: string,
): Promise<boolean> {
  const service = await createServiceClient();
  const { data: booking } = await service
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!booking) return false;
  const { data, error } = await service
    .from("inquiries")
    .update({ status: "converted", booking_id: bookingId })
    .eq("id", inquiryId)
    .eq("vendor_id", vendorId)
    .is("booking_id", null)
    .select("id");
  if (error) console.error("linkInquiryToBooking failed", error.message);
  return Boolean(data?.length);
}

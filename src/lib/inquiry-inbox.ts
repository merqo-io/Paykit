import { createServerClient } from "@/lib/supabase/server";
import type { Inquiry, InquiryForm } from "@/lib/types";
import { INQUIRY_COLUMNS, INQUIRY_FORM_COLUMNS } from "@/lib/columns";

export async function getInquiryForm(
  vendorId: string,
): Promise<InquiryForm | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inquiry_forms")
    .select(INQUIRY_FORM_COLUMNS)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (error) {
    console.error("getInquiryForm failed", error.message);
    return null;
  }
  return data;
}

/** Open inquiries only: a converted one lives on as its booking. */
export async function listOpenInquiries(vendorId: string): Promise<Inquiry[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select(INQUIRY_COLUMNS)
    .eq("vendor_id", vendorId)
    .neq("status", "converted")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listOpenInquiries failed", error.message);
    return [];
  }
  return data ?? [];
}

export async function getInquiry(
  vendorId: string,
  inquiryId: string,
): Promise<Inquiry | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select(INQUIRY_COLUMNS)
    .eq("vendor_id", vendorId)
    .eq("id", inquiryId)
    .maybeSingle();
  if (error) {
    console.error("getInquiry failed", error.message);
    return null;
  }
  return data;
}

export async function getInquiryForBooking(
  vendorId: string,
  bookingId: string,
): Promise<Inquiry | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select(INQUIRY_COLUMNS)
    .eq("vendor_id", vendorId)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) {
    console.error("getInquiryForBooking failed", error.message);
    return null;
  }
  return data;
}

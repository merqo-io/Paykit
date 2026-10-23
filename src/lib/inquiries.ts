import { rateLimit } from "@/lib/rate-limit";
import { sendInquiryAlert } from "@/lib/inquiry-alert";
import { publicIdSchema, type PublicInquiryInput } from "@/lib/inquiry-schemas";
import type { createServiceClient } from "@/lib/supabase/server";
import type { InquiryForm } from "@/lib/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type PublicInquiryForm = Pick<
  InquiryForm,
  "vendor_id" | "business_name" | "terms_url" | "terms_version"
>;

/** A submit faster than this after the form rendered is treated as a bot. */
export const MIN_FILL_MS = 3000;

/** When the form was rendered, for the fill-time check on submit. */
export function formRenderedAt(): number {
  return Date.now();
}

export const INQUIRY_LIMITS = {
  perIp: { limit: 5, windowSeconds: 600 },
  perForm: { limit: 30, windowSeconds: 3600 },
} as const;

/** The enabled form behind a public id, or null for any other case. */
export async function loadPublicForm(
  supabase: ServiceClient,
  publicId: string,
): Promise<PublicInquiryForm | null> {
  if (!publicIdSchema.safeParse(publicId).success) return null;
  const { data, error } = await supabase
    .from("inquiry_forms")
    .select("vendor_id, business_name, terms_url, terms_version")
    .eq("public_id", publicId)
    .eq("enabled", true)
    .maybeSingle();
  if (error) {
    console.error("loadPublicForm failed", error.message);
    return null;
  }
  return data;
}

/** Counted per address first, then per form, so a spread-out flood still stops. */
export async function inquiryAllowed(
  supabase: ServiceClient,
  ip: string,
  publicId: string,
): Promise<boolean> {
  const byIp = await rateLimit(
    supabase,
    `inquiry:ip:${ip}`,
    INQUIRY_LIMITS.perIp.limit,
    INQUIRY_LIMITS.perIp.windowSeconds,
  );
  if (!byIp) return false;
  return rateLimit(
    supabase,
    `inquiry:form:${publicId}`,
    INQUIRY_LIMITS.perForm.limit,
    INQUIRY_LIMITS.perForm.windowSeconds,
  );
}

export type SubmitInquiryResult =
  { ok: true } | { ok: false; reason: "terms_required" | "write_failed" };

/**
 * Stores the inquiry and alerts the vendor. The terms snapshot comes from
 * the form row the caller read on the server, never from the browser.
 */
export async function submitInquiry(
  supabase: ServiceClient,
  form: PublicInquiryForm,
  input: PublicInquiryInput,
  now: Date = new Date(),
): Promise<SubmitInquiryResult> {
  const hasTerms = form.terms_url !== null && form.terms_version !== null;
  if (hasTerms && !input.terms_accepted) {
    return { ok: false, reason: "terms_required" };
  }

  const { error } = await supabase.from("inquiries").insert({
    vendor_id: form.vendor_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    event_date: input.event_date || null,
    message: input.message,
    terms_url: hasTerms ? form.terms_url : null,
    terms_version: hasTerms ? form.terms_version : null,
    terms_accepted_at: hasTerms ? now.toISOString() : null,
  });
  if (error) {
    console.error("submitInquiry: insert failed", error.message);
    return { ok: false, reason: "write_failed" };
  }

  await sendInquiryAlert(form.vendor_id, input.customer_name, input.event_date);
  return { ok: true };
}

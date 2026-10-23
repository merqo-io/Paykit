"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/rate-limit";
import {
  inquiryAllowed,
  loadPublicForm,
  MIN_FILL_MS,
  submitInquiry,
} from "@/lib/inquiries";
import { publicIdSchema, publicInquirySchema } from "@/lib/inquiry-schemas";

export type InquiryActionState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

const NOT_FOUND = "This inquiry form is no longer available.";
const TOO_MANY = "Too many inquiries. Try again later.";
const TRY_AGAIN = "Could not send your inquiry. Try again.";
const TERMS = "Tick the box to accept the booking terms.";

function looksLikeBot(formData: FormData, now: number): boolean {
  if (String(formData.get("website") ?? "") !== "") return true;
  const raw = String(formData.get("started_at") ?? "");
  const startedAt = Number(raw);
  return (
    raw === "" || !Number.isFinite(startedAt) || now - startedAt < MIN_FILL_MS
  );
}

/**
 * The public form's only write. Nobody is signed in: the form is re-read by
 * its public id on every submit, so a form turned off after the page loaded
 * takes nothing. A bot gets the same "sent" answer and nothing is stored.
 */
export async function submitInquiryAction(
  publicId: string,
  _prev: InquiryActionState,
  formData: FormData,
): Promise<InquiryActionState> {
  if (!publicIdSchema.safeParse(publicId).success) {
    return { status: "error", message: NOT_FOUND };
  }
  if (looksLikeBot(formData, Date.now())) return { status: "sent" };

  const parsed = publicInquirySchema.safeParse({
    customer_name: formData.get("customer_name") ?? "",
    customer_phone: formData.get("customer_phone") ?? "",
    event_date: formData.get("event_date") ?? "",
    message: formData.get("message") ?? "",
    terms_accepted: formData.get("terms_accepted") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? TRY_AGAIN,
    };
  }

  const supabase = await createServiceClient();
  const ip = clientIp(await headers());
  if (!(await inquiryAllowed(supabase, ip, publicId))) {
    return { status: "error", message: TOO_MANY };
  }

  const form = await loadPublicForm(supabase, publicId);
  if (!form) return { status: "error", message: NOT_FOUND };

  const result = await submitInquiry(supabase, form, parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      message: result.reason === "terms_required" ? TERMS : TRY_AGAIN,
    };
  }
  return { status: "sent" };
}

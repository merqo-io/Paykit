"use server";

import { revalidatePath } from "next/cache";
import { getVendorSession } from "@/lib/vendor-session";
import {
  inquiryFormSettingsSchema,
  inquiryStatusUpdateSchema,
} from "@/lib/inquiry-schemas";

export type InquiryActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const BOOKINGS = "/dashboard/bookings";

export async function saveInquiryFormAction(
  _prev: InquiryActionState,
  formData: FormData,
): Promise<InquiryActionState> {
  const { supabase, user } = await getVendorSession();
  const parsed = inquiryFormSettingsSchema.safeParse({
    business_name: formData.get("business_name") ?? "",
    enabled: formData.get("enabled") === "on",
    terms_url: formData.get("terms_url") ?? "",
    terms_version: formData.get("terms_version") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const fields = {
    business_name: parsed.data.business_name,
    enabled: parsed.data.enabled,
    terms_url: parsed.data.terms_url || null,
    terms_version: parsed.data.terms_version || null,
  };
  // Update first: an upsert would also write `vendor_id`, which has no
  // update grant.
  const updated = await supabase
    .from("inquiry_forms")
    .update(fields)
    .eq("vendor_id", user.id)
    .select("vendor_id");
  const { error } =
    updated.error || updated.data?.length
      ? updated
      : await supabase
          .from("inquiry_forms")
          .insert({ vendor_id: user.id, ...fields });
  if (error) {
    console.error("saveInquiryFormAction failed", error.message);
    return { status: "error", message: "Could not save. Try again." };
  }
  revalidatePath(BOOKINGS);
  return { status: "ok" };
}

export async function setInquiryStatusAction(
  inquiryId: string,
  status: string,
): Promise<InquiryActionState> {
  const { supabase, user } = await getVendorSession();
  const parsed = inquiryStatusUpdateSchema.safeParse({
    inquiry_id: inquiryId,
    status,
  });
  if (!parsed.success) return { status: "error", message: "Invalid inquiry" };

  const { data, error } = await supabase
    .from("inquiries")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.inquiry_id)
    .eq("vendor_id", user.id)
    .neq("status", "converted")
    .select("id");
  if (error || !data?.length) {
    return { status: "error", message: "Could not update. Try again." };
  }
  revalidatePath(BOOKINGS);
  revalidatePath(`${BOOKINGS}/inquiries/${parsed.data.inquiry_id}`);
  return { status: "ok" };
}

export async function deleteInquiryAction(
  inquiryId: string,
): Promise<InquiryActionState> {
  const { supabase, user } = await getVendorSession();
  const parsed =
    inquiryStatusUpdateSchema.shape.inquiry_id.safeParse(inquiryId);
  if (!parsed.success) return { status: "error", message: "Invalid inquiry" };

  const { data, error } = await supabase
    .from("inquiries")
    .delete()
    .eq("id", parsed.data)
    .eq("vendor_id", user.id)
    .select("id");
  if (error || !data?.length) {
    return { status: "error", message: "Could not delete. Try again." };
  }
  revalidatePath(BOOKINGS);
  return { status: "ok" };
}

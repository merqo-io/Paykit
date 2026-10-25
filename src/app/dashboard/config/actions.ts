"use server";

import { getVendorSession } from "@/lib/vendor-session";
import { vendorPaymentConfigInputSchema } from "@/lib/schemas";
import type { VendorPaymentConfig } from "@/lib/types";
import { paymentConfigRow } from "@/lib/payment-config-row";
import { removeReplacedQrImage } from "@/lib/qr-image-cleanup";
import { CONFIG_COLUMNS } from "@/lib/columns";

export async function getConfig(): Promise<VendorPaymentConfig | null> {
  const { supabase, user } = await getVendorSession();
  const { data } = await supabase
    .from("vendor_payment_config")
    .select(CONFIG_COLUMNS)
    .eq("vendor_id", user.id)
    .maybeSingle();
  return data;
}

function configInputFromForm(formData: FormData) {
  if (formData.get("kind") === "pointer") {
    return {
      kind: "pointer",
      label: formData.get("label") ?? "",
      url: formData.get("url") || undefined,
      qr_image_url: formData.get("qr_image_url") || undefined,
    };
  }
  return {
    kind: "paynow",
    payee_name: formData.get("payee_name") ?? "",
    uen: formData.get("uen") ?? "",
    mobile: formData.get("mobile") ?? "",
  };
}

export type SaveConfigState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function saveConfigAction(
  _prev: SaveConfigState,
  formData: FormData,
): Promise<SaveConfigState> {
  const { supabase, user } = await getVendorSession();
  const parsed = vendorPaymentConfigInputSchema.safeParse(
    configInputFromForm(formData),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const row = paymentConfigRow(user.id, parsed.data);

  // Not `.upsert()`: PostgREST's ON CONFLICT DO UPDATE path checks for
  // table-level UPDATE privilege regardless of column-level grants, but this
  // table's `plan` column is deliberately excluded from the vendor's
  // column-scoped UPDATE grant (see 0001_paykit_core.sql) so a vendor can't
  // self-escalate to Pro. A plain update-or-insert respects column grants
  // like every other write in this app, so the existing grant is enough.
  const { vendor_id, ...writableFields } = row;
  const { data: existing } = await supabase
    .from("vendor_payment_config")
    .select("vendor_id, qr_image_url")
    .eq("vendor_id", vendor_id)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("vendor_payment_config")
        .update(writableFields)
        .eq("vendor_id", vendor_id)
    : await supabase.from("vendor_payment_config").insert(row);
  if (error) {
    console.error("saveConfigAction failed", error.message);
    return { status: "error", message: "Could not save. Try again." };
  }
  await removeReplacedQrImage(
    supabase,
    vendor_id,
    existing?.qr_image_url,
    row.qr_image_url,
  );
  return { status: "ok" };
}

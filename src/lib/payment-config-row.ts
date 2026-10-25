import type { z } from "zod";
import type { vendorPaymentConfigInputSchema } from "@/lib/schemas";

type ConfigInput = z.infer<typeof vendorPaymentConfigInputSchema>;

export type PaymentConfigRow = {
  vendor_id: string;
  kind: "paynow" | "pointer";
  payee_name: string | null;
  uen: string | null;
  mobile: string | null;
  label: string | null;
  url: string | null;
  qr_image_url: string | null;
};

/** The full `vendor_payment_config` row for a validated input; unused columns are nulled. */
export function paymentConfigRow(
  vendorId: string,
  input: ConfigInput,
): PaymentConfigRow {
  if (input.kind === "paynow") {
    return {
      vendor_id: vendorId,
      kind: "paynow",
      payee_name: input.payee_name,
      uen: input.uen ?? null,
      mobile: input.mobile ?? null,
      label: null,
      url: null,
      qr_image_url: null,
    };
  }
  return {
    vendor_id: vendorId,
    kind: "pointer",
    payee_name: null,
    uen: null,
    mobile: null,
    label: input.label,
    url: input.url ?? null,
    qr_image_url: input.qr_image_url ?? null,
  };
}

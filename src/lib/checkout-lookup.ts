import { checkoutKind } from "@/lib/checkout-kind";
import {
  toStatusResponse,
  type CheckoutLookupResponse,
} from "@/lib/api-schemas";

export const FALLBACK_LINK_LABEL = "Open payment link";

export type CheckoutLookupRow = {
  id: string;
  status: string;
  amount_cents: number;
  order_ref: string;
  kit_slug: string;
  vendor_id: string;
  claimed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  expires_at?: string | null;
  qr_payload: string;
  checkout_kind?: "qr" | "link" | "image" | null;
  checkout_label?: string | null;
};

function snapshotView(row: CheckoutLookupRow): CheckoutLookupResponse["view"] {
  const kind = checkoutKind(row);
  if (kind === "qr") return { type: "qr", payload: row.qr_payload };
  if (kind === "link")
    return {
      type: "link",
      url: row.qr_payload,
      label: row.checkout_label ?? FALLBACK_LINK_LABEL,
    };
  if (kind === "image") return { type: "image", url: row.qr_payload };
  return null;
}

/** Maps a `paykit.transactions` row to the order-ref lookup wire shape. */
export function toLookupResponse(
  row: CheckoutLookupRow,
): CheckoutLookupResponse {
  return {
    ...toStatusResponse(row),
    vendor_id: row.vendor_id,
    view: snapshotView(row),
  };
}

import type { CheckoutView } from "@/lib/payments/adapter";
import { checkoutKind } from "@/lib/checkout-kind";
import { FALLBACK_LINK_LABEL } from "@/lib/checkout-lookup";
import { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments/provider";
import { recordPaymentAudit } from "@/lib/payment-audit";
import type { VendorPaymentConfig } from "@/lib/types";

export type CreateCheckoutInput = {
  vendorId: string;
  kitSlug: string;
  orderRef: string;
  amountCents: number;
  /** When the calling kit gives up on the order; stored on a new checkout
   *  only. A replay keeps what the first call stored. */
  expiresAt?: string | null;
};

export type CheckoutResult =
  | { ok: true; type: "qr"; transaction_id: string; payload: string }
  | {
      ok: true;
      type: "link";
      transaction_id: string;
      url: string;
      label: string;
    }
  | { ok: true; type: "image"; transaction_id: string; url: string }
  | { ok: false; status: number; error: string };

function replayConflict(
  existing: {
    vendor_id: string;
    amount_cents: number;
    qr_payload: string;
    checkout_kind?: "qr" | "link" | "image" | null;
  },
  vendorId: string,
  amountCents: number,
  payload: string,
  kind: "qr" | "link" | "image",
): Extract<CheckoutResult, { ok: false }> | null {
  if (
    existing.vendor_id !== vendorId ||
    existing.amount_cents !== amountCents
  ) {
    return {
      ok: false,
      status: 409,
      error: "Order reference already belongs to a different checkout",
    };
  }
  if (checkoutKind(existing) !== kind || existing.qr_payload !== payload) {
    return {
      ok: false,
      status: 409,
      error: "Payment configuration changed since checkout creation",
    };
  }
  return null;
}
/**
 * Creates one `transactions` row and renders its checkout view (PayNow QR or
 * BYO pointer). Shared by `POST /api/v1/checkout` (bearer-secret, another
 * kit calling in) and the dashboard's own booking-deposit/balance actions
 * (vendor session, `kitSlug: "paykit"`) — one insert path so idempotency and
 * error handling stay in one place.
 */
export async function createCheckout({
  vendorId,
  kitSlug,
  orderRef,
  amountCents,
  expiresAt,
}: CreateCheckoutInput): Promise<CheckoutResult> {
  const supabase = await createServiceClient();

  const { data: config, error: configError } = await supabase
    .from("vendor_payment_config")
    .select("*")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (configError) {
    console.error("createCheckout: config read failed", configError.message);
    return { ok: false, status: 503, error: "Upstream unavailable" };
  }
  if (!config) {
    return { ok: false, status: 422, error: "vendor has no PayNow config" };
  }

  const view = await getProvider().createCheckout(
    config as VendorPaymentConfig,
    { amountCents, orderRef },
  );
  if (!view) {
    return {
      ok: false,
      status: 422,
      error: "vendor payment config is incomplete",
    };
  }

  // qr_payload is a generic "checkout payload" store — the QR payload for
  // type "qr", the link/image URL for "link"/"image". Column name unchanged
  // (additive-only migration), meaning generalized. See the design spec.
  const payloadValue = view.type === "qr" ? view.payload : view.url;

  const { data: inserted, error: insertError } = await supabase
    .from("transactions")
    .insert({
      vendor_id: vendorId,
      kit_slug: kitSlug,
      order_ref: orderRef,
      amount_cents: amountCents,
      qr_payload: payloadValue,
      checkout_kind: view.type,
      checkout_label: view.type === "link" ? view.label : null,
      // Left out when absent, so a checkout without one inserts the same
      // row it always has.
      ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
    })
    .select(
      "id, qr_payload, vendor_id, amount_cents, checkout_kind, checkout_label",
    )
    .single();

  // A retry of the same (kit_slug, order_ref) — e.g. a caller-side timeout —
  // hits the unique constraint (0007_paykit_checkout_idempotency.sql) rather
  // than creating a duplicate pending transaction; re-read and return the
  // transaction the first call already created.
  // isFreshInsert: only a genuinely new checkout gets an audit row.
  const isFreshInsert = !insertError && !!inserted;
  let tx = inserted;
  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("transactions")
      .select(
        "id, qr_payload, vendor_id, amount_cents, checkout_kind, checkout_label",
      )
      .eq("kit_slug", kitSlug)
      .eq("order_ref", orderRef)
      .single();
    if (existingError || !existing) {
      console.error(
        "createCheckout: idempotent re-read failed",
        existingError?.message,
      );
      return { ok: false, status: 503, error: "Could not create checkout" };
    }
    const conflict = replayConflict(
      existing,
      vendorId,
      amountCents,
      payloadValue,
      view.type,
    );
    if (conflict) return conflict;
    tx = existing;
  } else if (insertError || !inserted) {
    console.error("createCheckout: insert failed", insertError?.message);
    return { ok: false, status: 503, error: "Could not create checkout" };
  }
  if (!tx) {
    return { ok: false, status: 503, error: "Could not create checkout" };
  }

  if (isFreshInsert) {
    await recordPaymentAudit(supabase, tx.id, kitSlug, "checkout_created");
  }

  return checkoutResponse(view, tx, isFreshInsert);
}

function checkoutResponse(
  view: CheckoutView,
  tx: { id: string; qr_payload: string; checkout_label?: string | null },
  isFreshInsert: boolean,
): CheckoutResult {
  if (view.type === "qr") {
    return {
      ok: true,
      type: "qr",
      transaction_id: tx.id,
      payload: tx.qr_payload,
    };
  }
  if (view.type === "link") {
    return {
      ok: true,
      type: "link",
      transaction_id: tx.id,
      url: tx.qr_payload,
      label: isFreshInsert
        ? view.label
        : (tx.checkout_label ?? FALLBACK_LINK_LABEL),
    };
  }
  return { ok: true, type: "image", transaction_id: tx.id, url: tx.qr_payload };
}

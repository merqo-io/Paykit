import type { CheckoutView } from "@/lib/payments/adapter";
import { checkoutKind } from "@/lib/checkout-kind";
import { FALLBACK_LINK_LABEL } from "@/lib/checkout-lookup";
import { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/payments/provider";
import { recordPaymentAudit } from "@/lib/payment-audit";
import { mintPayToken } from "@/lib/pay-token";
import type { TxStatus, VendorPaymentConfig } from "@/lib/types";

/** What a caller that wants the hosted pay page supplies. `returnUrl` has
 *  already been checked against the calling kit's registered origin. */
export type HostedPayInput = { returnUrl: string; title: string | null };

export type CreateCheckoutInput = {
  vendorId: string;
  kitSlug: string;
  orderRef: string;
  amountCents: number;
  /** When the calling kit gives up on the order; stored on a new checkout
   *  only. A replay keeps what the first call stored. */
  expiresAt?: string | null;
  hostedPay?: HostedPayInput;
};

// `status` is the transaction's own state: `pending` for a new checkout, and
// whatever the stored row holds for a replay. `payToken` is set only when the
// caller asked for the hosted pay page; it is the one time the token exists
// outside the customer's link.
type CheckoutCommon = {
  ok: true;
  transaction_id: string;
  status: TxStatus;
  payToken?: string;
};

export type CheckoutResult =
  | (CheckoutCommon & { type: "qr"; payload: string })
  | (CheckoutCommon & { type: "link"; url: string; label: string })
  | (CheckoutCommon & { type: "image"; url: string })
  | { ok: false; status: number; error: string };

const TX_COLUMNS =
  "id, status, qr_payload, vendor_id, amount_cents, checkout_kind, checkout_label";

function replayConflict(
  existing: {
    vendor_id: string;
    amount_cents: number;
    qr_payload: string;
    checkout_kind?: "qr" | "link" | "image" | null;
  },
  { vendorId, amountCents, payloadValue, kind }: ReplayInput,
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
  if (checkoutKind(existing) !== kind || existing.qr_payload !== payloadValue) {
    return {
      ok: false,
      status: 409,
      error: "Payment configuration changed since checkout creation",
    };
  }
  return null;
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type HostedColumns = {
  pay_token_hash: string;
  return_url: string;
  pay_title: string | null;
};

const CREATE_FAILED: Extract<CheckoutResult, { ok: false }> = {
  ok: false,
  status: 503,
  error: "Could not create checkout",
};

function hostedColumnsFor(
  hostedPay: HostedPayInput | undefined,
  tokenHash: string | undefined,
): HostedColumns | null {
  if (!hostedPay || !tokenHash) return null;
  return {
    pay_token_hash: tokenHash,
    return_url: hostedPay.returnUrl,
    pay_title: hostedPay.title,
  };
}

/**
 * Points an existing transaction's pay page at a newly minted token. The
 * token it replaces stops opening the page. False when the write did not
 * land on exactly one row.
 */
async function replacePayToken(
  supabase: ServiceClient,
  transactionId: string,
  hostedColumns: HostedColumns,
): Promise<boolean> {
  const { data: rotated, error } = await supabase
    .from("transactions")
    .update(hostedColumns)
    .eq("id", transactionId)
    .select("id");
  if (error || (rotated ?? []).length !== 1) {
    console.error("createCheckout: pay token write failed", error?.message);
    return false;
  }
  return true;
}

type ReplayInput = {
  vendorId: string;
  kitSlug: string;
  orderRef: string;
  amountCents: number;
  payloadValue: string;
  kind: "qr" | "link" | "image";
  hostedColumns: HostedColumns | null;
};

/**
 * The transaction a repeated create-checkout refers to, once it is shown to
 * be the same checkout. Its pay token is replaced when the caller asked for
 * the hosted pay page.
 */
async function replayExisting(supabase: ServiceClient, input: ReplayInput) {
  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("kit_slug", input.kitSlug)
    .eq("order_ref", input.orderRef)
    .single();
  if (existingError || !existing) {
    console.error(
      "createCheckout: idempotent re-read failed",
      existingError?.message,
    );
    return CREATE_FAILED;
  }
  const conflict = replayConflict(existing, input);
  if (conflict) return conflict;
  if (
    input.hostedColumns &&
    !(await replacePayToken(supabase, existing.id, input.hostedColumns))
  )
    return CREATE_FAILED;
  return { ok: true as const, tx: existing };
}

async function buildView(
  supabase: ServiceClient,
  vendorId: string,
  amountCents: number,
  orderRef: string,
): Promise<
  { ok: true; view: CheckoutView } | Extract<CheckoutResult, { ok: false }>
> {
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
  return { ok: true, view };
}

type StoreInput = {
  vendorId: string;
  kitSlug: string;
  orderRef: string;
  amountCents: number;
  expiresAt?: string | null;
  view: CheckoutView;
  payloadValue: string;
  hostedColumns: HostedColumns | null;
};

/** Inserts the transaction, or on an idempotent retry re-reads the one the first call created. */
async function storeTransaction(supabase: ServiceClient, input: StoreInput) {
  const { vendorId, kitSlug, orderRef, amountCents, expiresAt, view } = input;
  const { data: inserted, error: insertError } = await supabase
    .from("transactions")
    .insert({
      vendor_id: vendorId,
      kit_slug: kitSlug,
      order_ref: orderRef,
      amount_cents: amountCents,
      qr_payload: input.payloadValue,
      checkout_kind: view.type,
      checkout_label: view.type === "link" ? view.label : null,
      ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
      ...input.hostedColumns,
    })
    .select(TX_COLUMNS)
    .single();

  // A retry of the same (kit_slug, order_ref) hits the unique constraint
  // (0007_paykit_checkout_idempotency.sql) instead of duplicating the row.
  if (insertError?.code === "23505") {
    const replayed = await replayExisting(supabase, {
      vendorId,
      kitSlug,
      orderRef,
      amountCents,
      payloadValue: input.payloadValue,
      kind: view.type,
      hostedColumns: input.hostedColumns,
    });
    if (!replayed.ok) return replayed;
    return { ok: true as const, tx: replayed.tx, isFreshInsert: false };
  }
  if (insertError || !inserted) {
    console.error("createCheckout: insert failed", insertError?.message);
    return CREATE_FAILED;
  }
  return { ok: true as const, tx: inserted, isFreshInsert: true };
}

/**
 * Creates one `transactions` row and renders its checkout view (PayNow QR or
 * BYO pointer). Shared by `POST /api/v1/checkout` (bearer-secret, another
 * kit calling in) and the dashboard's own booking-deposit/balance actions
 * (vendor session, `kitSlug: "paykit"`) — one insert path so idempotency and
 * error handling stay in one place.
 *
 * With `hostedPay` a pay token is minted and its hash stored with the return
 * address and title. A replay mints a new one and replaces the stored hash,
 * since the first token cannot be read back: the previous pay link stops
 * working. Without `hostedPay` nothing about a pay page is written or changed.
 */
export async function createCheckout({
  vendorId,
  kitSlug,
  orderRef,
  amountCents,
  expiresAt,
  hostedPay,
}: CreateCheckoutInput): Promise<CheckoutResult> {
  const supabase = await createServiceClient();

  const built = await buildView(supabase, vendorId, amountCents, orderRef);
  if (!built.ok) return built;
  const { view } = built;

  // qr_payload is a generic "checkout payload" store — the QR payload for
  // type "qr", the link/image URL for "link"/"image". Column name unchanged
  // (additive-only migration), meaning generalized. See the design spec.
  const payloadValue = view.type === "qr" ? view.payload : view.url;

  const minted = hostedPay ? mintPayToken() : null;
  const hostedColumns = hostedColumnsFor(hostedPay, minted?.hash);

  const stored = await storeTransaction(supabase, {
    vendorId,
    kitSlug,
    orderRef,
    amountCents,
    expiresAt,
    view,
    payloadValue,
    hostedColumns,
  });
  if (!stored.ok) return stored;
  const { tx, isFreshInsert } = stored;

  if (isFreshInsert) {
    await recordPaymentAudit(supabase, {
      transactionId: tx.id,
      kitSlug,
      action: "checkout_created",
    });
  }

  return checkoutResponse(view, tx, isFreshInsert, minted?.token);
}

const TX_STATUSES: readonly string[] = ["pending", "claimed", "confirmed"];

// A new checkout is pending by definition. A replayed one reports what the
// row holds, so a caller never treats a paid transaction as unpaid.
function statusOf(
  tx: { status?: string | null },
  isFreshInsert: boolean,
): TxStatus {
  if (isFreshInsert || !tx.status || !TX_STATUSES.includes(tx.status))
    return "pending";
  return tx.status as TxStatus;
}

function checkoutResponse(
  view: CheckoutView,
  tx: {
    id: string;
    qr_payload: string;
    status?: string | null;
    checkout_label?: string | null;
  },
  isFreshInsert: boolean,
  payToken: string | undefined,
): CheckoutResult {
  const common: CheckoutCommon = {
    ok: true,
    transaction_id: tx.id,
    status: statusOf(tx, isFreshInsert),
    ...(payToken ? { payToken } : {}),
  };
  if (view.type === "qr") {
    return { ...common, type: "qr", payload: tx.qr_payload };
  }
  if (view.type === "link") {
    return {
      ...common,
      type: "link",
      url: tx.qr_payload,
      label: isFreshInsert
        ? view.label
        : (tx.checkout_label ?? FALLBACK_LINK_LABEL),
    };
  }
  return { ...common, type: "image", url: tx.qr_payload };
}

import { z } from "zod";
import { RETURN_URL_MAX } from "@/lib/return-url";

export const txStatusSchema = z.enum(["pending", "claimed", "confirmed"]);

/** Shared UUID validator for path params (`transactions.id`, `vendor_payment_config.vendor_id`) — a malformed value is a 400, not a DB-error 503. */
export const uuidSchema = z.string().uuid();

/** Furthest ahead a calling kit may place a checkout's `expires_at`. */
export const MAX_EXPIRES_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/** Also the column's own length check (0024). */
export const PAY_TITLE_MAX = 120;

/** `expires_at` is when the calling kit gives up on the order. A time already
 *  past is accepted: a kit derives it from its order, so a late reload of a
 *  pay page sends one, and such a checkout simply never matches a detected
 *  payment. It never stops a person claiming or confirming.
 *
 *  `return_url` and `title` are for the hosted pay page. With `return_url`
 *  the answer carries a `pay_url` to send the customer to; paykit sends them
 *  back to `return_url` once the payment is claimed. `return_url` must be on
 *  the calling kit's registered origin, which the route checks. `title` is
 *  the one line the page shows above the amount. */
export const checkoutRequestSchema = z.object({
  vendor_id: uuidSchema,
  amount_cents: z.number().int().positive(),
  order_ref: z.string().trim().min(1).max(200),
  expires_at: z
    .string()
    .datetime({ offset: true, message: "expires_at must be an ISO 8601 time" })
    .refine((v) => Date.parse(v) - Date.now() <= MAX_EXPIRES_AHEAD_MS, {
      message: "expires_at is more than 7 days ahead",
    })
    .nullish(),
  return_url: z.string().min(1).max(RETURN_URL_MAX).optional(),
  title: z.string().trim().min(1).max(PAY_TITLE_MAX).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

// `status` is the transaction's state when the answer was made: `pending`
// for a new checkout, anything for a replay. `pay_url` is present only when
// the request carried a `return_url`, and each such request makes the
// previous `pay_url` for the transaction stop working.
const checkoutCommonFields = {
  transaction_id: z.string().uuid(),
  status: txStatusSchema,
  pay_url: z.string().url().optional(),
};

export const checkoutResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("qr"),
    ...checkoutCommonFields,
    payload: z.string().min(1),
  }),
  z.object({
    type: z.literal("link"),
    ...checkoutCommonFields,
    url: z.string().url(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    ...checkoutCommonFields,
    url: z.string().url(),
  }),
]);
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export const transactionStatusResponseSchema = z.object({
  transaction_id: z.string(),
  status: txStatusSchema,
  amount_cents: z.number().int().positive(),
  order_ref: z.string(),
  kit_slug: z.string(),
  claimed_at: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
});
export type TransactionStatusResponse = z.infer<
  typeof transactionStatusResponseSchema
>;

export const checkoutLookupQuerySchema = z.object({
  order_ref: z.string().trim().min(1).max(200),
});

const snapshotViewSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("qr"), payload: z.string().min(1) }),
  z.object({
    type: z.literal("link"),
    url: z.string().url(),
    label: z.string(),
  }),
  z.object({ type: z.literal("image"), url: z.string().url() }),
]);

/** `GET /api/v1/checkout?order_ref=`. `view` is the snapshot stored when the
 *  checkout was created, never rebuilt from the vendor's current config; it
 *  is null for a row whose display kind cannot be proven. `vendor_id` is the
 *  vendor that owns the transaction, returned so the calling kit can confirm
 *  the transaction belongs to the vendor it is acting for. */
export const checkoutLookupResponseSchema =
  transactionStatusResponseSchema.extend({
    vendor_id: uuidSchema,
    view: snapshotViewSchema.nullable(),
  });
export type CheckoutLookupResponse = z.infer<
  typeof checkoutLookupResponseSchema
>;

/** Body paykit posts to a calling kit's `callback_url` after a claim, unclaim
 *  or confirm commits. It is a hint that the transaction changed: the
 *  receiver reads the real status back with `GET /api/v1/checkout?order_ref=`
 *  and must not act on `status` here. */
export const paymentStatusCallbackSchema = z.object({
  order_ref: z.string().min(1).max(200),
  transaction_id: uuidSchema,
  status: txStatusSchema,
});
export type PaymentStatusCallback = z.infer<typeof paymentStatusCallbackSchema>;

/** `GET /api/v1/checkout/{id}/evidence`. `proof_url` is a signed link to the
 *  payment screenshot, valid for 300 seconds, or null when there is none.
 *  `duplicate_of` names another transaction of the same vendor, in any kit,
 *  that carries the same screenshot. `amount_match` says whether the
 *  transaction's amount was found in the screenshot; null means not checked.
 *  Both signals are hints for a person, never proof that money arrived. */
export const checkoutEvidenceResponseSchema = z.object({
  proof_url: z.string().url().nullable(),
  signals: z.object({
    duplicate_of: z
      .object({ order_ref: z.string(), kit_slug: z.string() })
      .nullable(),
    amount_match: z.boolean().nullable(),
  }),
});
export type CheckoutEvidenceResponse = z.infer<
  typeof checkoutEvidenceResponseSchema
>;

export const bookingStatusResponseSchema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum([
    "pending_deposit",
    "deposit_paid",
    "fully_paid",
    "cancelled",
  ]),
  event_date: z.string(),
  deposit_amount_cents: z.number().int().positive(),
  balance_amount_cents: z.number().int().positive(),
  total_amount_cents: z.number().int().positive(),
  deposit_confirmed: z.boolean(),
  balance_confirmed: z.boolean(),
});
export type BookingStatusResponse = z.infer<typeof bookingStatusResponseSchema>;

export const vendorConfigResponseSchema = z.object({
  has_config: z.boolean(),
  display_name: z.string().nullable(),
  // Full editable config, so a calling kit can pre-fill its own edit form
  // on re-open. GET always sets these; POST's response only ever carries
  // has_config/display_name, so they're optional here to cover both.
  kind: z.enum(["paynow", "pointer"]).nullable().optional(),
  payee_name: z.string().nullable().optional(),
  uen: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  qr_image_url: z.string().nullable().optional(),
});
export type VendorConfigResponse = z.infer<typeof vendorConfigResponseSchema>;

type TransactionRow = {
  id: string;
  status: string;
  amount_cents: number;
  order_ref: string;
  kit_slug: string;
  claimed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  expires_at?: string | null;
};

/** Maps a `paykit.transactions` row to the `/api/v1/checkout/*` wire shape. */
export function toStatusResponse(
  row: TransactionRow,
): TransactionStatusResponse {
  return {
    transaction_id: row.id,
    status: row.status as TransactionStatusResponse["status"],
    amount_cents: row.amount_cents,
    order_ref: row.order_ref,
    kit_slug: row.kit_slug,
    claimed_at: row.claimed_at,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
  };
}

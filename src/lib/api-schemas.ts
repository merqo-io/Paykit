import { z } from "zod";

export const txStatusSchema = z.enum(["pending", "claimed", "confirmed"]);

/** Shared UUID validator for path params (`transactions.id`, `vendor_payment_config.vendor_id`) — a malformed value is a 400, not a DB-error 503. */
export const uuidSchema = z.string().uuid();

export const checkoutRequestSchema = z.object({
  vendor_id: uuidSchema,
  amount_cents: z.number().int().positive(),
  order_ref: z.string().trim().min(1).max(200),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const checkoutResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("qr"),
    transaction_id: z.string().uuid(),
    payload: z.string().min(1),
  }),
  z.object({
    type: z.literal("link"),
    transaction_id: z.string().uuid(),
    url: z.string().url(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    transaction_id: z.string().uuid(),
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
 *  is null for a row whose display kind cannot be proven. */
export const checkoutLookupResponseSchema =
  transactionStatusResponseSchema.extend({
    view: snapshotViewSchema.nullable(),
  });
export type CheckoutLookupResponse = z.infer<
  typeof checkoutLookupResponseSchema
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
  };
}

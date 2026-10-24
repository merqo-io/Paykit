// Explicit column lists for every table read, so a new column is never returned by default.

export const TRANSACTION_COLUMNS =
  "id, vendor_id, kit_slug, order_ref, amount_cents, status, qr_payload, checkout_kind, checkout_label, return_url, pay_title, claimed_at, confirmed_at, created_at, expires_at" as const;

export const TRANSACTION_WITH_TOKEN_COLUMNS =
  "id, vendor_id, kit_slug, order_ref, amount_cents, status, qr_payload, checkout_kind, checkout_label, pay_token_hash, return_url, pay_title, claimed_at, confirmed_at, created_at, expires_at" as const;

export const CONFIG_COLUMNS =
  "vendor_id, kind, uen, mobile, payee_name, label, url, qr_image_url, verification_method, plan, created_at, updated_at" as const;

export const BOOKING_COLUMNS =
  "id, vendor_id, customer_name, customer_phone, event_date, total_amount_cents, deposit_amount_cents, balance_amount_cents, balance_due_date, status, deposit_transaction_id, balance_transaction_id, created_at, updated_at" as const;

export const INQUIRY_FORM_COLUMNS =
  "vendor_id, public_id, business_name, enabled, terms_url, terms_version, created_at, updated_at" as const;

export const INQUIRY_COLUMNS =
  "id, vendor_id, customer_name, customer_phone, event_date, message, status, terms_url, terms_version, terms_accepted_at, booking_id, created_at, updated_at" as const;

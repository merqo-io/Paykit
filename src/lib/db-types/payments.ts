import type { Json } from "./json";

export type TxStatus = "pending" | "claimed" | "confirmed";

export type Transaction = {
  id: string;
  vendor_id: string;
  kit_slug: string;
  order_ref: string;
  amount_cents: number;
  status: TxStatus;
  qr_payload: string;
  checkout_kind?: "qr" | "link" | "image" | null;
  checkout_label?: string | null;
  pay_token_hash?: string | null;
  return_url?: string | null;
  pay_title?: string | null;
  claimed_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  expires_at?: string | null;
};

export type Refund = {
  id: string;
  transaction_id: string;
  refunded_amount_cents: number;
  reason: string | null;
  created_by: string;
  created_at: string;
};

export type Feedback = {
  id: number;
  vendor_id: string;
  nps: number;
  message: string | null;
  created_at: string;
};

export type PaymentAudit = {
  id: string;
  transaction_id: string;
  kit_slug: string;
  action: string;
  detail: Json;
  created_at: string;
};

/** One piece of evidence about a transaction (migration 0022). */
export type PaymentEvidence = {
  id: string;
  transaction_id: string;
  kind: "screenshot";
  storage_path: string | null;
  content_hash: string | null;
  detail: Json;
  created_at: string;
};

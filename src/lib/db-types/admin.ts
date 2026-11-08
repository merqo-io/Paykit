import type { Json } from "./json";

export type Admin = {
  user_id: string;
  created_at: string;
};

export type AdminAudit = {
  id: string;
  admin_id: string;
  action: string;
  target_id: string | null;
  detail: Json;
  created_at: string;
};

export type AuthFailure = {
  id: string;
  kit_slug: string | null;
  reason: string;
  ip: string | null;
  created_at: string;
};

/** A payment screenshot object waiting to be removed from Storage (migration 0032). */
export type ProofStorageDeletion = {
  id: number;
  bucket: string;
  path: string;
  queued_at: string;
  attempts: number;
  last_error: string | null;
};

/** A failure paykit wrote for Merqo's ops view (migration 0026). */
export type OpsEvent = {
  id: number;
  vendor_id: string;
  kind: "payment_callback_failed";
  ref: string;
  code: string;
  created_at: string;
};

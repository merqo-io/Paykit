import type { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types";

export type PaymentAuditAction =
  "checkout_created" | "claimed" | "confirmed" | "unclaimed";

/**
 * Append one payment_audit row. Best-effort: a hiccup here must not fail the
 * transition it records, but it's logged so a broken trail stays visible.
 *
 * Takes the caller's own already-created service-role client (every call
 * site here already has one in scope for its transaction read/write)
 * instead of creating its own, unlike `recordAudit` — those call sites
 * don't already have a client in scope.
 */
export async function recordPaymentAudit(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  {
    transactionId,
    kitSlug,
    action,
    detail = null,
  }: {
    transactionId: string;
    kitSlug: string;
    action: PaymentAuditAction;
    detail?: Json;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("payment_audit").insert({
      transaction_id: transactionId,
      kit_slug: kitSlug,
      action,
      detail,
    });
    if (error) console.error("payment_audit insert failed", error.message);
  } catch {
    console.error("payment_audit unavailable");
  }
}

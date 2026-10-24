"use server";

import { revalidatePath } from "next/cache";
import { dollarsToCents } from "@/lib/money";
import { getVendorSession } from "@/lib/vendor-session";
import { issueRefundInputSchema } from "@/lib/schemas";
import { recordAudit } from "@/lib/admin-audit";

export type RefundState = { status: "idle" | "ok" | "error"; message?: string };

// Relies on the `refunds_insert_own` RLS policy (Task 4) to be the real
// enforcement: it checks ownership, `transactions.status = 'confirmed'`, and
// `vendor_payment_config.plan = 'pro'` at the DB layer via `with check`. This
// action only validates shape/UX — never trust a client-supplied "I'm Pro"
// flag, and never widen the policy to make this insert succeed.
export async function issueRefundAction(
  _prev: RefundState,
  formData: FormData,
): Promise<RefundState> {
  const { supabase, user } = await getVendorSession();
  const parsed = issueRefundInputSchema.safeParse({
    transaction_id: formData.get("transaction_id") ?? "",
    refunded_amount_cents: dollarsToCents(formData.get("refunded_amount")),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Enter a valid refund amount.",
    };
  }

  const { error } = await supabase.from("refunds").insert({
    transaction_id: parsed.data.transaction_id,
    refunded_amount_cents: parsed.data.refunded_amount_cents,
    reason: parsed.data.reason || null,
    created_by: user.id,
  });
  if (error) {
    console.error("issueRefundAction failed", error.message);
    return {
      status: "error",
      message:
        "Could not record refund. Check the transaction is confirmed and you're on Pro.",
    };
  }

  await recordAudit(user.id, "record_refund", parsed.data.transaction_id, {
    refunded_amount_cents: parsed.data.refunded_amount_cents,
    reason: parsed.data.reason || null,
  });

  revalidatePath("/dashboard/transactions");
  return { status: "ok" };
}

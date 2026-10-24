import type { createServiceClient } from "@/lib/supabase/server";
import { claimTransition } from "@/lib/tx-state";
import { recordPaymentAudit } from "@/lib/payment-audit";
import { schedulePaymentStatusCallback } from "@/lib/kit-callback";
import { storeScreenshotEvidence } from "@/lib/payment-evidence";
import { scheduleProofAmountCheck } from "@/lib/proof-amount-check";
import type { ProofFile } from "@/lib/proof-file";
import type { Json, Transaction } from "@/lib/types";
import { TRANSACTION_COLUMNS } from "@/lib/columns";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type ClaimOutcome =
  | { ok: true; row: Transaction }
  | { ok: false; status: 404 | 503; error: string };

/** Who the claim is recorded against in `payment_audit`, and any detail. */
export type ClaimAudit = { kitSlug: string; detail?: Json };

/**
 * The guarded update matched no row. Either a concurrent request moved the
 * transaction first, in which case its current state is the answer, or the
 * write itself failed, in which case nothing changed.
 */
async function outcomeAfterLostUpdate(
  supabase: ServiceClient,
  id: string,
  previousStatus: string,
): Promise<ClaimOutcome> {
  const { data: recheck, error: recheckError } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (recheckError || (recheck && recheck.status === previousStatus))
    return { ok: false, status: 503, error: "Upstream unavailable" };
  if (!recheck) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, row: recheck };
}

/**
 * Records that the customer says they have paid: `pending` becomes
 * `claimed`. One function for every way a claim arrives (a calling kit's
 * request, the hosted pay page), so the steps below cannot drift apart.
 *
 * `current` is the row as the caller just read it. The caller has already
 * decided the request may act on it.
 *
 * The screenshot, when there is one, is stored before the claim commits, so
 * a transaction is never claimed on the strength of a file paykit does not
 * hold. Once a vendor has confirmed, the evidence they confirmed against is
 * left alone. An already claimed or confirmed transaction is answered as it
 * stands, with no audit row and no callback.
 */
export async function claimTransaction(
  supabase: ServiceClient,
  current: Transaction,
  proof: ProofFile | null,
  audit: ClaimAudit,
): Promise<ClaimOutcome> {
  if (proof && current.status !== "confirmed") {
    const stored = await storeScreenshotEvidence(supabase, current, proof);
    if (!stored)
      return {
        ok: false,
        status: 503,
        error: "Could not store the payment proof",
      };
    // Reading the amount out of the screenshot takes a second or more, so
    // it runs once the response has gone out and never decides the claim.
    scheduleProofAmountCheck(supabase, current, proof);
  }

  const { status, changed } = claimTransition(current.status);
  if (!changed) return { ok: true, row: current };

  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({ status, claimed_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("status", "pending")
    .select(TRANSACTION_COLUMNS)
    .single();
  if (updateError || !updated)
    return outcomeAfterLostUpdate(supabase, current.id, current.status);

  await recordPaymentAudit(
    supabase,
    current.id,
    audit.kitSlug,
    "claimed",
    audit.detail ?? null,
  );
  schedulePaymentStatusCallback(updated);
  return { ok: true, row: updated };
}

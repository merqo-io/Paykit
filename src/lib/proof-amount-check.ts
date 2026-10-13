import { after } from "next/server";
import type { createServiceClient } from "@/lib/supabase/server";
import { hashProof } from "@/lib/payment-evidence";
import type { ProofFile } from "@/lib/proof-file";
import { recognizeText } from "@/lib/proof-ocr";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type CheckedTransaction = { id: string; amount_cents: number };

// A money amount with two decimals, standing by itself: "12.50" and
// "1,250.00" are amounts; the "5.50" inside "15.50" is not.
const AMOUNT = /(?:^|[^\d.,])((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?![\d.,])/g;

/**
 * Whether `text` shows the amount `amountCents` as a complete figure. A
 * match says the screenshot mentions the right sum. It does not say money
 * arrived: a screenshot can be edited, old, or of another transfer.
 */
export function amountInText(text: string, amountCents: number): boolean {
  const expected = (amountCents / 100).toFixed(2);
  return Array.from(text.matchAll(AMOUNT), (match) => match[1]).some(
    (amount) => amount.replaceAll(",", "") === expected,
  );
}

/**
 * Reads a stored screenshot and records, on its evidence row, whether the
 * transaction's amount appears in it. The row is matched by the file's hash
 * as well as the transaction, so a slow read of a screenshot that has since
 * been replaced writes nothing. When the image cannot be read the row is
 * left alone and `amount_match` stays null, "not checked". Never throws.
 */
export async function checkProofAmount(
  supabase: ServiceClient,
  tx: CheckedTransaction,
  proof: ProofFile,
): Promise<void> {
  try {
    const text = await recognizeText(proof.bytes);
    const { error } = await supabase
      .from("payment_evidence")
      .update({ detail: { amount_match: amountInText(text, tx.amount_cents) } })
      .eq("transaction_id", tx.id)
      .eq("kind", "screenshot")
      .eq("content_hash", hashProof(proof.bytes));
    if (error)
      console.error("payment_evidence: amount write failed", error.message);
  } catch (error) {
    console.error(
      "payment_evidence: amount check failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

/**
 * Runs the amount check once the claim's response has gone out. Reading a
 * screenshot takes a second or more, and the calling kit is waiting on the
 * claim, so the check must not hold the response.
 */
export function scheduleProofAmountCheck(
  supabase: ServiceClient,
  tx: CheckedTransaction,
  proof: ProofFile,
): void {
  try {
    after(() => checkProofAmount(supabase, tx, proof));
  } catch {
    // `after` throws where there is no request to outlive. The claim has
    // already been decided; the amount simply stays unchecked.
    console.error("payment_evidence: amount check not scheduled");
  }
}

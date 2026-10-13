import { createHash } from "node:crypto";
import type { createServiceClient } from "@/lib/supabase/server";
import type { CheckoutEvidenceResponse } from "@/lib/api-schemas";
import { PROOF_BUCKET, type ProofFile } from "@/lib/proof-file";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type EvidenceTransaction = { id: string; vendor_id: string };

const SIGNED_URL_SECONDS = 300;

// How many other rows with the same hash are checked for the same vendor.
// One vendor reusing a photo yields a handful; the cap only bounds the query.
const DUPLICATE_SCAN_LIMIT = 100;

const NO_EVIDENCE: CheckoutEvidenceResponse = {
  proof_url: null,
  signals: { duplicate_of: null, amount_match: null },
};

/** Hex digest (sha256) of the file's bytes. */
export function hashProof(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Where a transaction's screenshot lives in the proof bucket. The first
 * folder is the vendor, which the bucket's read policy keys on. There is no
 * file extension, so a second upload of another image type replaces the
 * first instead of leaving it behind.
 */
export function proofPath(tx: EvidenceTransaction): string {
  return `${tx.vendor_id}/${tx.id}`;
}

/**
 * Stores a payment screenshot for a transaction: the file, then its row.
 * A second screenshot for the same transaction replaces the first. Returns
 * false on any failure and never throws; the caller must not claim the
 * transaction when this returns false.
 */
export async function storeScreenshotEvidence(
  supabase: ServiceClient,
  tx: EvidenceTransaction,
  proof: ProofFile,
): Promise<boolean> {
  const path = proofPath(tx);
  try {
    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(path, proof.bytes, {
        upsert: true,
        contentType: proof.contentType,
      });
    if (uploadError) {
      console.error("payment_evidence: upload failed", uploadError.message);
      return false;
    }

    const { error } = await supabase.from("payment_evidence").upsert(
      {
        transaction_id: tx.id,
        kind: "screenshot",
        storage_path: path,
        content_hash: hashProof(proof.bytes),
        detail: {},
        created_at: new Date().toISOString(),
      },
      { onConflict: "transaction_id,kind" },
    );
    if (error) {
      console.error("payment_evidence: row write failed", error.message);
      return false;
    }
    return true;
  } catch {
    console.error("payment_evidence: storage unavailable");
    return false;
  }
}

async function signedProofUrl(
  supabase: ServiceClient,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error("payment_evidence: signing failed", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * The oldest other transaction of the same vendor, in any kit, whose
 * screenshot has the same hash. A failed lookup is logged and reported as no
 * duplicate, so the vendor still gets the photo to judge by eye.
 */
async function findDuplicate(
  supabase: ServiceClient,
  tx: EvidenceTransaction,
  hash: string | null,
): Promise<{ order_ref: string; kit_slug: string } | null> {
  if (!hash) return null;
  const { data: matches, error: matchError } = await supabase
    .from("payment_evidence")
    .select("transaction_id")
    .eq("kind", "screenshot")
    .eq("content_hash", hash)
    .neq("transaction_id", tx.id)
    .limit(DUPLICATE_SCAN_LIMIT);
  if (matchError) {
    console.error(
      "payment_evidence: duplicate scan failed",
      matchError.message,
    );
    return null;
  }
  const ids = (matches ?? []).map((row) => row.transaction_id);
  if (ids.length === 0) return null;

  const { data: other, error } = await supabase
    .from("transactions")
    .select("order_ref, kit_slug")
    .in("id", ids)
    .eq("vendor_id", tx.vendor_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("payment_evidence: duplicate lookup failed", error.message);
    return null;
  }
  return other
    ? { order_ref: other.order_ref, kit_slug: other.kit_slug }
    : null;
}

function amountMatch(detail: unknown): boolean | null {
  if (typeof detail !== "object" || detail === null) return null;
  const value = (detail as Record<string, unknown>).amount_match;
  return typeof value === "boolean" ? value : null;
}

/**
 * What paykit holds as evidence for one transaction, in the wire shape of
 * `GET /api/v1/checkout/{id}/evidence`. Returns null only when the evidence
 * row itself could not be read. Never throws.
 */
export async function loadCheckoutEvidence(
  supabase: ServiceClient,
  tx: EvidenceTransaction,
): Promise<CheckoutEvidenceResponse | null> {
  try {
    const { data: row, error } = await supabase
      .from("payment_evidence")
      .select("storage_path, content_hash, detail")
      .eq("transaction_id", tx.id)
      .eq("kind", "screenshot")
      .maybeSingle();
    if (error) {
      console.error("payment_evidence: read failed", error.message);
      return null;
    }
    if (!row) return NO_EVIDENCE;

    const [proofUrl, duplicateOf] = await Promise.all([
      signedProofUrl(supabase, row.storage_path),
      findDuplicate(supabase, tx, row.content_hash),
    ]);
    return {
      proof_url: proofUrl,
      signals: {
        duplicate_of: duplicateOf,
        amount_match: amountMatch(row.detail),
      },
    };
  } catch {
    console.error("payment_evidence: unavailable");
    return null;
  }
}

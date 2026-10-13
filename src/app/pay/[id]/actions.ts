"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { claimTransaction } from "@/lib/claim";
import { hostedPayAllowed, loadHostedPayment } from "@/lib/hosted-pay";
import { readProofFile } from "@/lib/proof-file";
import { clientIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";
import type { TxStatus } from "@/lib/types";

// These two actions are the hosted pay page's whole write and read surface.
// Nobody is signed in: the pay token is the authorization, checked by
// loadHostedPayment on every call. Each answers with a status and the return
// address and nothing else about the transaction.

const INVALID_LINK = "This payment link is no longer valid.";
const TRY_AGAIN = "Could not record payment. Try again.";
const TOO_MANY = "Too many attempts. Wait a moment.";

export type HostedClaimResult = ActionResult<{ returnUrl: string | null }>;

export type HostedPaymentStatus = {
  status: TxStatus;
  returnUrl: string | null;
};

function proofError(status: 400 | 413): string {
  return status === 413
    ? "That image is too large. Try a screenshot instead of a photo."
    : "Upload a screenshot or photo (JPEG, PNG or WebP).";
}

/**
 * The customer's "I've paid": stores their payment screenshot with the
 * transaction and marks it claimed. A claim is the customer's word and the
 * screenshot is something for the vendor to look at; neither says money
 * arrived.
 *
 * A wrong token and an unknown id get the same answer. Anything that fails
 * before the claim commits leaves the transaction pending, so the customer
 * can try again.
 */
export async function claimHostedPayment(
  id: unknown,
  token: unknown,
  formData: unknown,
): Promise<HostedClaimResult> {
  if (typeof id !== "string" || typeof token !== "string")
    return { success: false, error: INVALID_LINK };
  if (!(formData instanceof FormData))
    return { success: false, error: "A payment screenshot is required." };

  const supabase = await createServiceClient();
  const ip = clientIp(await headers());
  if (!(await hostedPayAllowed(supabase, "claim", ip, token)))
    return { success: false, error: TOO_MANY };

  const read = await loadHostedPayment(supabase, id, token);
  if (!read.ok)
    return {
      success: false,
      error: read.reason === "not_found" ? INVALID_LINK : TRY_AGAIN,
    };

  const files = formData.getAll("proof");
  if (files.length !== 1 || typeof files[0] === "string")
    return { success: false, error: "A payment screenshot is required." };
  const proof = await readProofFile(files[0]);
  if (!proof.ok) return { success: false, error: proofError(proof.status) };

  const outcome = await claimTransaction(supabase, read.row, proof.proof, {
    kitSlug: read.row.kit_slug,
    detail: { via: "pay_page" },
  });
  if (!outcome.ok || outcome.row.status === "pending")
    return { success: false, error: TRY_AGAIN };

  return { success: true, returnUrl: read.payment.returnUrl };
}

/**
 * What the open pay page polls: has this payment been claimed or confirmed
 * yet, by any route. Null when the link is not valid, the call was rate
 * limited, or the database could not be read; the page then simply asks
 * again later.
 */
export async function getHostedPaymentStatus(
  id: unknown,
  token: unknown,
): Promise<HostedPaymentStatus | null> {
  if (typeof id !== "string" || typeof token !== "string") return null;

  const supabase = await createServiceClient();
  const ip = clientIp(await headers());
  if (!(await hostedPayAllowed(supabase, "status", ip, token))) return null;

  const read = await loadHostedPayment(supabase, id, token);
  if (!read.ok) return null;
  return { status: read.payment.status, returnUrl: read.payment.returnUrl };
}

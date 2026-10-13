import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { claimTransition, type TxStatus } from "@/lib/tx-state";
import { toStatusResponse, uuidSchema } from "@/lib/api-schemas";
import { recordPaymentAudit } from "@/lib/payment-audit";
import { schedulePaymentStatusCallback } from "@/lib/kit-callback";
import { readProofFromRequest } from "@/lib/proof-file";
import { storeScreenshotEvidence } from "@/lib/payment-evidence";
import {
  clientIp,
  rateLimit,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * The guarded update matched no row. Either a concurrent request moved the
 * transaction first, in which case its current state is the answer, or the
 * write itself failed, in which case nothing changed.
 */
async function answerAfterLostUpdate(
  supabase: ServiceClient,
  id: string,
  previousStatus: string,
) {
  const { data: recheck, error: recheckError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (recheckError || (recheck && recheck.status === previousStatus)) {
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (!recheck)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toStatusResponse(recheck));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();
  const ip = clientIp(request.headers);
  const allowed = await rateLimit(
    supabase,
    `claim:${auth.kitSlug}:${ip}`,
    PER_ROUTE_LIMIT,
    PER_ROUTE_WINDOW_SECONDS,
  );
  if (!allowed)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid transaction id" },
      { status: 400 },
    );
  }

  const proofRead = await readProofFromRequest(request);
  if (!proofRead.ok)
    return NextResponse.json(
      { error: proofRead.error },
      { status: proofRead.status },
    );

  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("claim: read failed", readError.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (!current)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The screenshot is stored before the claim commits, so a transaction is
  // never claimed on the strength of a file paykit does not hold. Once a
  // vendor has confirmed, the evidence they confirmed against is left alone.
  if (proofRead.proof && current.status !== "confirmed") {
    const stored = await storeScreenshotEvidence(
      supabase,
      current,
      proofRead.proof,
    );
    if (!stored)
      return NextResponse.json(
        { error: "Could not store the payment proof" },
        { status: 503 },
      );
  }

  const { status, changed } = claimTransition(current.status as TxStatus);
  if (!changed) return NextResponse.json(toStatusResponse(current));

  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({ status, claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (updateError || !updated)
    return answerAfterLostUpdate(supabase, id, current.status);

  await recordPaymentAudit(supabase, id, auth.kitSlug, "claimed");
  schedulePaymentStatusCallback(updated);
  return NextResponse.json(toStatusResponse(updated));
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { unclaimTransition, type TxStatus } from "@/lib/tx-state";
import { toStatusResponse, uuidSchema } from "@/lib/api-schemas";
import { recordPaymentAudit } from "@/lib/payment-audit";
import { schedulePaymentStatusCallback } from "@/lib/kit-callback";
import {
  clientIp,
  rateLimit,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";
import { TRANSACTION_COLUMNS } from "@/lib/columns";

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
    `unclaim:${auth.kitSlug}:${ip}`,
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

  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("unclaim: read failed", readError.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (!current)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, changed } = unclaimTransition(current.status as TxStatus);
  if (!changed) return NextResponse.json(toStatusResponse(current));

  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({ status, claimed_at: null })
    .eq("id", id)
    .eq("status", "claimed")
    .select(TRANSACTION_COLUMNS)
    .single();
  if (updateError || !updated) {
    const { data: recheck, error: recheckError } = await supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (recheckError || (recheck && recheck.status === current.status)) {
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 503 },
      );
    }
    if (!recheck)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toStatusResponse(recheck));
  }

  await recordPaymentAudit(supabase, id, auth.kitSlug, "unclaimed");
  schedulePaymentStatusCallback(updated);
  return NextResponse.json(toStatusResponse(updated));
}

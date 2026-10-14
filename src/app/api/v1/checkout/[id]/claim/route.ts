import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { toStatusResponse, uuidSchema } from "@/lib/api-schemas";
import { claimTransaction } from "@/lib/claim";
import { readProofFromRequest } from "@/lib/proof-file";
import {
  clientIp,
  rateLimit,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";

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

  const outcome = await claimTransaction(supabase, current, proofRead.proof, {
    kitSlug: auth.kitSlug,
  });
  if (!outcome.ok)
    return NextResponse.json(
      { error: outcome.error },
      { status: outcome.status },
    );
  return NextResponse.json(toStatusResponse(outcome.row));
}

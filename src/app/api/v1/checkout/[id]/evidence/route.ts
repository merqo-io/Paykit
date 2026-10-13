import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { uuidSchema } from "@/lib/api-schemas";
import { loadCheckoutEvidence } from "@/lib/payment-evidence";
import {
  clientIp,
  rateLimit,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";

// The body carries a signed link that expires, so nothing may cache it.
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
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
    `evidence:${auth.kitSlug}:${ip}`,
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

  // A kit reads evidence for its own transactions only. The duplicate signal
  // is the one part that looks across kits, and only within one vendor.
  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("id, vendor_id")
    .eq("id", id)
    .eq("kit_slug", auth.kitSlug)
    .maybeSingle();
  if (error) {
    console.error("evidence: read failed", error.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (!transaction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const evidence = await loadCheckoutEvidence(supabase, transaction);
  if (!evidence)
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );

  return NextResponse.json(evidence, { headers: NO_STORE });
}

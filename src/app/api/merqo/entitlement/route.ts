import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { provisionBearerOk } from "@/lib/merqo-auth";
import { entitlementPayloadSchema } from "@/lib/merqo-entitlement-contract";

export const revalidate = 0;

const KIT = "paykit";

/**
 * Receives merqo's push of a vendor's entitlement and stores it in
 * paykit.vendor_entitlements. Ordering by issued_at is decided atomically in
 * the database, so a stale or replayed push is a successful no-op.
 */
export async function POST(request: Request) {
  if (!provisionBearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = entitlementPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const payload = parsed.data;
  if (payload.kit !== KIT) {
    return NextResponse.json({ ok: false, error: "wrong_kit" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("apply_vendor_entitlement", {
    p_email: payload.email,
    p_tier: payload.tier,
    p_founder: payload.founder,
    p_stats_window: payload.stats_window,
    p_event_pass_starts_at: payload.event_pass?.starts_at ?? null,
    p_event_pass_ends_at: payload.event_pass?.ends_at ?? null,
    p_valid_until: payload.valid_until,
    p_issued_at: payload.issued_at,
  });
  if (error) {
    console.error("paykit entitlement: store failed", error.message);
    return NextResponse.json({ ok: false, error: "store_failed" }, { status: 500 });
  }
  if (data === "unknown_vendor") {
    return NextResponse.json({ ok: false, error: "unknown_vendor" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

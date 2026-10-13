import { NextResponse } from "next/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import {
  checkoutLookupQuerySchema,
  checkoutRequestSchema,
} from "@/lib/api-schemas";
import { toLookupResponse } from "@/lib/checkout-lookup";
import { createCheckout } from "@/lib/checkout";
import { createServiceClient } from "@/lib/supabase/server";
import {
  clientIp,
  rateLimit,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";

/** Finds the calling kit's transaction for one of its own order references,
 *  so a kit that stores no transaction id never has to create a checkout
 *  just to learn it. Read-only. */
export async function GET(request: Request) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();
  const allowed = await rateLimit(
    supabase,
    `checkout-lookup:${auth.kitSlug}:${clientIp(request.headers)}`,
    PER_ROUTE_LIMIT,
    PER_ROUTE_WINDOW_SECONDS,
  );
  if (!allowed)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = checkoutLookupQuerySchema.safeParse({
    order_ref: new URL(request.url).searchParams.get("order_ref") ?? undefined,
  });
  if (!parsed.success)
    return NextResponse.json(
      { error: "order_ref is required" },
      { status: 400 },
    );

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("kit_slug", auth.kitSlug)
    .eq("order_ref", parsed.data.order_ref)
    .maybeSingle();
  if (error) {
    console.error("checkout lookup: read failed", error.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toLookupResponse(data));
}

export async function POST(request: Request) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = clientIp(request.headers);
  const allowed = await rateLimit(
    await createServiceClient(),
    `checkout:${auth.kitSlug}:${ip}`,
    PER_ROUTE_LIMIT,
    PER_ROUTE_WINDOW_SECONDS,
  );
  if (!allowed)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const result = await createCheckout({
    vendorId: parsed.data.vendor_id,
    kitSlug: auth.kitSlug,
    orderRef: parsed.data.order_ref,
    amountCents: parsed.data.amount_cents,
    expiresAt: parsed.data.expires_at,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  if (result.type === "qr") {
    return NextResponse.json({
      type: "qr",
      transaction_id: result.transaction_id,
      payload: result.payload,
    });
  }
  if (result.type === "link") {
    return NextResponse.json({
      type: "link",
      transaction_id: result.transaction_id,
      url: result.url,
      label: result.label,
    });
  }
  return NextResponse.json({
    type: "image",
    transaction_id: result.transaction_id,
    url: result.url,
  });
}

import { NextResponse } from "next/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import {
  checkoutLookupQuerySchema,
  checkoutRequestSchema,
} from "@/lib/api-schemas";
import {
  CHECKOUT_LOOKUP_COLUMNS,
  toLookupResponse,
} from "@/lib/checkout-lookup";
import { createCheckout, type HostedPayInput } from "@/lib/checkout";
import { kitReturnUrl } from "@/lib/return-url";
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

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type HostedPayRead =
  | { ok: true; hostedPay: HostedPayInput | undefined }
  | { ok: false; status: 400 | 503; error: string };

/**
 * What the hosted pay page needs from a create-checkout request, or
 * `undefined` when the caller did not ask for one. A `return_url` is only
 * accepted on the origin registered for the calling kit, so the pay page can
 * never be made to redirect anywhere else.
 */
async function readHostedPay(
  supabase: ServiceClient,
  kitSlug: string,
  returnUrl: string | undefined,
  title: string | undefined,
): Promise<HostedPayRead> {
  if (returnUrl === undefined) return { ok: true, hostedPay: undefined };

  const { data, error } = await supabase
    .from("kit_api_keys")
    .select("return_origin")
    .eq("kit_slug", kitSlug)
    .maybeSingle();
  if (error) {
    console.error("checkout: return_origin read failed", error.message);
    return { ok: false, status: 503, error: "Upstream unavailable" };
  }

  const checked = kitReturnUrl(returnUrl, data?.return_origin);
  if (!checked)
    return {
      ok: false,
      status: 400,
      error: "return_url is not allowed for this kit",
    };
  return { ok: true, hostedPay: { returnUrl: checked, title: title ?? null } };
}

function payUrl(request: Request, transactionId: string, token: string) {
  const url = new URL(`/pay/${transactionId}`, new URL(request.url).origin);
  url.searchParams.set("k", token);
  return url.href;
}

export async function POST(request: Request) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();
  const ip = clientIp(request.headers);
  const allowed = await rateLimit(
    supabase,
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

  const hosted = await readHostedPay(
    supabase,
    auth.kitSlug,
    parsed.data.return_url,
    parsed.data.title,
  );
  if (!hosted.ok)
    return NextResponse.json(
      { error: hosted.error },
      { status: hosted.status },
    );

  const result = await createCheckout({
    vendorId: parsed.data.vendor_id,
    kitSlug: auth.kitSlug,
    orderRef: parsed.data.order_ref,
    amountCents: parsed.data.amount_cents,
    expiresAt: parsed.data.expires_at,
    hostedPay: hosted.hostedPay,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const common = {
    transaction_id: result.transaction_id,
    status: result.status,
    ...(result.payToken
      ? { pay_url: payUrl(request, result.transaction_id, result.payToken) }
      : {}),
  };
  if (result.type === "qr") {
    return NextResponse.json({
      type: "qr",
      ...common,
      payload: result.payload,
    });
  }
  if (result.type === "link") {
    return NextResponse.json({
      type: "link",
      ...common,
      url: result.url,
      label: result.label,
    });
  }
  return NextResponse.json({ type: "image", ...common, url: result.url });
}

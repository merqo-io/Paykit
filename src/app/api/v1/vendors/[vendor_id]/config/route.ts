import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { uuidSchema } from "@/lib/api-schemas";
import { vendorPaymentConfigInputSchema } from "@/lib/schemas";
import { paymentConfigRow } from "@/lib/payment-config-row";
import { removeReplacedQrImage } from "@/lib/qr-image-cleanup";

const NO_CONFIG = {
  kind: null,
  payee_name: null,
  uen: null,
  mobile: null,
  label: null,
  url: null,
  qr_image_url: null,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ vendor_id: string }> },
) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor_id } = await params;
  if (!uuidSchema.safeParse(vendor_id).success) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("vendor_payment_config")
    .select("kind, payee_name, uen, mobile, label, url, qr_image_url")
    .eq("vendor_id", vendor_id)
    .maybeSingle();
  if (error) {
    console.error("vendor config: read failed", error.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }

  let display_name: string | null = null;
  if (data)
    display_name = data.kind === "paynow" ? data.payee_name : data.label;

  return NextResponse.json({
    has_config: Boolean(data),
    display_name,
    ...(data ?? NO_CONFIG),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ vendor_id: string }> },
) {
  const auth = await verifyKitAuth(request);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor_id } = await params;
  if (!uuidSchema.safeParse(vendor_id).success) {
    return NextResponse.json({ error: "Invalid vendor id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = vendorPaymentConfigInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const row = paymentConfigRow(vendor_id, parsed.data);

  const supabase = await createServiceClient();
  const { data: previous } = await supabase
    .from("vendor_payment_config")
    .select("qr_image_url")
    .eq("vendor_id", vendor_id)
    .maybeSingle();
  const { error } = await supabase
    .from("vendor_payment_config")
    .upsert(row, { onConflict: "vendor_id" });
  if (error) {
    console.error("vendor config: write failed", error.message);
    return NextResponse.json(
      { error: "Upstream unavailable" },
      { status: 503 },
    );
  }

  await removeReplacedQrImage(
    supabase,
    vendor_id,
    previous?.qr_image_url,
    row.qr_image_url,
  );

  const display_name =
    parsed.data.kind === "paynow" ? parsed.data.payee_name : parsed.data.label;

  return NextResponse.json({
    has_config: true,
    display_name,
  });
}

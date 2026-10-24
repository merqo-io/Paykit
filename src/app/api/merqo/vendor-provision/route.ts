import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { provisionBearerOk } from "@/lib/merqo-auth";
import { recordAudit } from "@/lib/admin-audit";

export const revalidate = 0;

const bodySchema = z.object({ user_id: z.uuid() });

export async function POST(request: Request) {
  if (!provisionBearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const { user_id } = parsed.data;

  const supabase = await createServiceClient();

  // Never writes: vendor_payment_config's payee_name/uen/mobile have no safe
  // default (a placeholder PayNow proxy could misdirect a real payment) —
  // this route only reports whatever is already there.
  const { data, error } = await supabase
    .from("vendor_payment_config")
    .select("plan")
    .eq("vendor_id", user_id)
    .maybeSingle();
  if (error) {
    console.error("paykit vendor-provision: read failed", error.message);
    return NextResponse.json(
      { error: "Could not read vendor payment config" },
      { status: 500 },
    );
  }

  // No signed-in admin here — adminId is the vendor's own id (satisfies
  // the FK) and detail.actor marks this as merqo-, not vendor-, initiated.
  await recordAudit(user_id, "merqo_vendor_provision", user_id, {
    actor: "merqo_system",
    already_existed: Boolean(data),
    needs_setup: !data,
    plan: data?.plan ?? null,
  });

  return NextResponse.json({
    ok: true,
    already_existed: Boolean(data),
    needs_setup: !data,
    plan: data?.plan ?? null,
  });
}

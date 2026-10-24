"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
// eslint-disable-next-line no-restricted-imports -- admin reads rows across vendors that RLS hides; gated by requireAdmin
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { recordAudit } from "@/lib/admin-audit";

const setVendorPlanSchema = z.object({
  vendorId: z.uuid(),
  plan: z.enum(["free", "pro"]),
});

/**
 * Set a vendor's plan directly. Admin-only: requireAdmin() 404s non-admins
 * before any write. Uses the service-role client (allowed in Server Actions)
 * because `plan` is writer-restricted to service_role only (see
 * 0001_paykit_core.sql's grant comment) — a vendor could otherwise
 * self-escalate to Pro via the Pro-only refund insert policy it gates.
 */
export async function setVendorPlan(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = setVendorPlanSchema.safeParse({
    vendorId: formData.get("vendorId"),
    plan: formData.get("plan"),
  });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from("vendor_payment_config")
    .update({ plan: parsed.data.plan })
    .eq("vendor_id", parsed.data.vendorId)
    .select("vendor_id")
    .maybeSingle();
  if (error || !updated) {
    console.error("setVendorPlan failed", error?.message ?? "no row updated");
    return { success: false, error: "Could not update plan" };
  }

  await recordAudit(user.id, "set_vendor_plan", parsed.data.vendorId, {
    plan: parsed.data.plan,
  });

  revalidatePath("/admin/vendors");
  return { success: true };
}

// No monthly SaaS price in this kit should plausibly exceed this — a local
// sanity bound (paykit has no shared MAX_MONEY_CENTS constant, unlike qkit).
// 100,000 cents = $1,000.
const PRICE_CENTS_MAX = 100_000;

const setPricingSchema = z.object({
  monthly_cents: z.number().int().nonnegative().max(PRICE_CENTS_MAX),
});

/**
 * Update the single pricing row (id = 1) shown on the plan page, dashboard
 * nudge, and landing copy. Admin-only: requireAdmin() 404s non-admins
 * before any write. Service-role client — pricing has no write policy at
 * all (see 0008_paykit_pricing.sql), so only this path can ever change it.
 */
export async function setPricing(
  input: z.infer<typeof setPricingSchema>,
): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = setPricingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("pricing")
    .update({
      monthly_cents: parsed.data.monthly_cents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    console.error("setPricing failed", error.message);
    return { success: false, error: "Could not update pricing" };
  }

  await recordAudit(user.id, "set_pricing", null, {
    monthly_cents: parsed.data.monthly_cents,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plan");
  revalidatePath("/");
  return { success: true };
}

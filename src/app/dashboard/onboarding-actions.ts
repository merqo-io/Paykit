"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

// Onboarding state is cosmetic: every write here is best-effort, RLS scopes
// it to the signed-in vendor's own vendor_prefs row, and nothing reads it
// for authorization. These actions take no client input; the vendor id comes
// from the session and the timestamps are generated here.

async function writeOnboardingPref(
  column: "onboarding_dismissed_at",
  value: string | null,
): Promise<void> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // The upsert names only vendor_id and the one column, so the row's other
    // prefs (tour_seen_at, qr_previewed_at) are left as they are.
    const { error } = await supabase
      .from("vendor_prefs")
      .upsert({ vendor_id: user.id, [column]: value });
    if (error) console.error("onboarding pref write failed", error.message);
    else revalidatePath("/dashboard");
  } catch {
    console.error("onboarding pref write unavailable");
  }
}

export async function dismissOnboarding(): Promise<void> {
  await writeOnboardingPref(
    "onboarding_dismissed_at",
    new Date().toISOString(),
  );
}

/** Clears the dismissal so Home shows the checklist again (the More sheet's "Setup guide" row). */
export async function reopenOnboarding(): Promise<void> {
  await writeOnboardingPref("onboarding_dismissed_at", null);
}

/** Stamps the first time the vendor sees the live QR preview; later calls leave the original time. */
export async function markQrPreviewed(): Promise<void> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("vendor_prefs")
      .select("qr_previewed_at")
      .eq("vendor_id", user.id)
      .maybeSingle();
    if (existing?.qr_previewed_at) return;

    const { error } = await supabase.from("vendor_prefs").upsert({
      vendor_id: user.id,
      qr_previewed_at: new Date().toISOString(),
    });
    if (error) console.error("markQrPreviewed failed", error.message);
    else revalidatePath("/dashboard");
  } catch {
    console.error("markQrPreviewed unavailable");
  }
}

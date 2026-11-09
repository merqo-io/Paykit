"use server";

import { revalidatePath } from "next/cache";
import { getVendorSession } from "@/lib/vendor-session";
import { patchVendorProfile } from "@/lib/merqo-vendor-profile";
import {
  profileNameSchema,
  socialLinksSchema,
  type ProfileNameInput,
  type SocialLinksInput,
} from "@/lib/schemas";
import type { ActionResult } from "@merqo/ui/kit-api";

/**
 * Update the vendor's shared business name. Persisted in
 * merqo.vendor_profile (shared across every kit — see `Merqo Business/docs/
 * business/2026-07-21-profile-settings-page-standard.md`) via the
 * patch_vendor_profile RPC, not a paykit-local table write (paykit has no
 * local vendors table — vendor_id is just the auth user id).
 */
export async function updateStallName(
  input: ProfileNameInput,
): Promise<ActionResult> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: "Enter a business name",
    };

  const { supabase, user } = await getVendorSession();

  try {
    await patchVendorProfile(supabase, user.id, {
      stallName: parsed.data.name,
    });
  } catch (err) {
    console.error(
      "updateStallName failed",
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: "Could not save business name. Try again.",
    };
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}

/**
 * Update the vendor's profile-level social/website links. Same
 * merqo.vendor_profile write path as updateStallName.
 */
export async function updateSocialLinks(
  input: SocialLinksInput,
): Promise<ActionResult> {
  const parsed = socialLinksSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check your links",
    };

  const { supabase, user } = await getVendorSession();

  try {
    await patchVendorProfile(supabase, user.id, { socialLinks: parsed.data });
  } catch (err) {
    console.error(
      "updateSocialLinks failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not save links. Try again." };
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}

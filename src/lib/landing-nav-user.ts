import type { SupabaseClient } from "@supabase/supabase-js";
import { toNavUser, type NavUser } from "@merqo/ui";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Nav identity for public pages. The vendor's stall name comes from merqo's
 * profile; a failed lookup falls back to the auth user's own name or email so
 * a profile outage never breaks a marketing page.
 */
export async function landingNavUser<
  Db,
  SchemaName extends string & Exclude<keyof Db, "__InternalSupabase">,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  user: AuthUser | null,
): Promise<NavUser | null> {
  if (!user) return null;
  let stallName: string | null = null;
  try {
    stallName = (await getOrCreateVendorProfile(supabase, user.id, null))
      .stall_name;
  } catch {
    stallName = null;
  }
  return toNavUser(user, stallName);
}

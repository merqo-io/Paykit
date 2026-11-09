"use server";

import { createServerClient } from "@/lib/supabase/server";
import { supportMessageSchema } from "@/lib/schemas";
import { submitSupportMessage } from "@/lib/merqo-support";
import type { ActionResult } from "@merqo/ui/kit-api";

/**
 * Submit a vendor's Get-help message. Inline session check, not the
 * shared `getVendorSession()` guard (used by dashboard/profile &
 * dashboard/transactions actions): that helper redirects to /login on no
 * session, which is wrong here — this action backs a Sheet-embedded
 * widget off the dashboard nav, not a full page, same reasoning
 * feedback.ts already established for its own Sheet-embedded action.
 */
export async function submitSupportMessageAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = supportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitSupportMessage(
      supabase,
      parsed.data.category,
      parsed.data.body,
    );
  } catch (err) {
    console.error(
      "submitSupportMessageAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send your message" };
  }
  return { success: true };
}

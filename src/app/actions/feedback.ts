"use server";
import { createServerClient } from "@/lib/supabase/server";
import { feedbackSchema, type FeedbackInput } from "@/lib/schemas";
import { submitVendorFeedback } from "@/lib/merqo-vendor-feedback";
import type { ActionResult } from "@merqo/ui/kit-api";

/**
 * Submit vendor NPS feedback for paykit into the shared cross-kit
 * merqo.vendor_feedback table via merqo.submit_vendor_feedback — the
 * SECURITY DEFINER function is the authorization boundary (it writes
 * auth.uid() as vendor_id itself, never a passed-in value).
 */
export async function submitFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback",
    };
  }

  const supabase = await createServerClient();
  // Intentionally an inline check, not the shared `getVendorSession()`
  // guard (used by dashboard/profile & dashboard/transactions actions):
  // that helper redirects to /login on no-session, which is wrong here —
  // this action backs a Sheet-embedded widget, not a full page, so an
  // unauthenticated caller should get a toast-visible error instead of a
  // hard redirect out of whatever page the Sheet is open on.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in first" };

  try {
    await submitVendorFeedback(
      supabase,
      "paykit",
      parsed.data.nps,
      parsed.data.message ?? null,
    );
  } catch (err) {
    console.error(
      "submitFeedbackAction failed",
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: "Could not send feedback" };
  }
  return { success: true };
}

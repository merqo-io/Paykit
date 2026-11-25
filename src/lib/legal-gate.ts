import { redirect } from "next/navigation";
import { safeRedirectPath } from "@merqo/ui";
import { checkLegalAcceptance as checkSharedLegalAcceptance } from "@merqo/ui/auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Is this vendor's terms + privacy acceptance current with the versions
 * @merqo/ui's LEGAL_VERSIONS requires?
 *
 * paykit does not own the acceptance record, merqo does, so the shared check
 * calls merqo's GET /api/merqo/legal-status and caches the answer in
 * paykit.legal_check_state for a short TTL. It fails closed: a missing
 * secret, an unreachable merqo, a non-2xx response or a malformed body all
 * resolve to `false`, which routes the vendor to /legal/accept.
 */
export function checkLegalAcceptance(email: string): Promise<boolean> {
  return checkSharedLegalAcceptance(email, {
    createClient: createServiceClient,
    customerSecret: process.env.MERQO_CUSTOMER_SECRET,
    merqoBaseUrl: process.env.MERQO_BASE_URL,
  });
}

// The shared check answers only true/false, and fails closed to false on an
// outage too. It upserts paykit.legal_check_state on every answer it really
// got from merqo, so a recent is_current=false row means "terms changed" and
// anything else means the check itself could not be answered. Must stay at or
// above the shared cache TTL.
const DEFINITIVE_ANSWER_WINDOW_MS = 5 * 60 * 1000;

// Tolerates this server's clock being slightly behind the one that stamped
// the row, which would otherwise read a fresh answer as unavailable.
const CLOCK_SKEW_MS = 30 * 1000;

export type LegalStatus = "current" | "stale" | "unavailable";

/** Like checkLegalAcceptance, but says why a failed check failed. */
export async function legalStatus(email: string): Promise<LegalStatus> {
  if (await checkLegalAcceptance(email)) return "current";
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("legal_check_state")
      .select("checked_at, is_current")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) console.error("legalStatus: state read failed", error.message);
    const age = data ? Date.now() - new Date(data.checked_at).getTime() : null;
    if (
      data &&
      data.is_current === false &&
      age !== null &&
      age >= -CLOCK_SKEW_MS &&
      age <= DEFINITIVE_ANSWER_WINDOW_MS
    ) {
      return "stale";
    }
  } catch {
    // Not knowing is treated as an outage: the vendor stays gated either way.
  }
  return "unavailable";
}

/**
 * Page/layout guard companion to the auth-gate helpers: bounce a signed-in
 * vendor with a stale or missing legal acceptance to the /legal/accept
 * interstitial. Called at the same point unauthenticated users are sent to
 * /login. A no-op when `email` is falsy (the caller has already handled the
 * no-session case) so it never runs after that redirect has fired.
 *
 * An outage still blocks (fail closed) but is sent with `reason=unavailable`
 * so the page does not claim the terms changed. `returnTo` is the retry
 * destination and is reduced to a same-origin relative path.
 */
export async function requireCurrentLegalAcceptance(
  email: string | undefined | null,
  returnTo?: string,
): Promise<void> {
  if (!email) return;
  const status = await legalStatus(email);
  if (status === "current") return;
  if (status === "stale") redirect("/legal/accept");
  const next = safeRedirectPath(returnTo, "/dashboard");
  redirect(`/legal/accept?reason=unavailable&next=${encodeURIComponent(next)}`);
}

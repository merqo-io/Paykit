import { redirect } from "next/navigation";
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

/**
 * Page/layout guard companion to the auth-gate helpers: bounce a signed-in
 * vendor with a stale or missing legal acceptance to the /legal/accept
 * interstitial. Called at the same point unauthenticated users are sent to
 * /login. A no-op when `email` is falsy (the caller has already handled the
 * no-session case) so it never runs after that redirect has fired.
 */
export async function requireCurrentLegalAcceptance(
  email: string | undefined | null,
): Promise<void> {
  if (email && !(await checkLegalAcceptance(email))) {
    redirect("/legal/accept");
  }
}

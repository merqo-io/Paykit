"use client";

import { useRouter } from "next/navigation";
import { MfaForm as SharedMfaForm, navigatingAway } from "@merqo/ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  verifiedFactorId: string | null;
  staleFactorIds: string[];
};

const ENROL_ERROR = "Could not start setup. Try again.";
const SHORT_CODE_ERROR = "Enter the 6-digit code from your authenticator app.";
const VERIFY_ERROR =
  "That code did not work. Check the time on your phone and try again.";

const FIXED_COPY = new Set([ENROL_ERROR, SHORT_CODE_ERROR, VERIFY_ERROR]);

// Without mapError the shared form swaps any returned string for its own
// default copy. The three strings above are final vendor copy and pass
// through; anything else (a thrown router error, say) must never reach the
// screen raw, so it becomes the wrong-code copy.
const showCopy = (raw: string) => (FIXED_COPY.has(raw) ? raw : VERIFY_ERROR);

/** Binds the shared form to Supabase TOTP: stale unverified factors are
 *  dropped before a new enrolment so abandoned setups never pile up. */
export function MfaForm({ verifiedFactorId, staleFactorIds }: Props) {
  const router = useRouter();

  async function onEnrol() {
    try {
      const supabase = createClient();
      for (const id of staleFactorIds) {
        await supabase.auth.mfa.unenroll({ factorId: id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error || !data) return ENROL_ERROR;
      return {
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      };
    } catch {
      return ENROL_ERROR;
    }
  }

  async function onVerify(code: string, context: { factorId?: string }) {
    const factorId = context.factorId ?? verifiedFactorId;
    if (!factorId) return SHORT_CODE_ERROR;
    try {
      const { error } = await createClient().auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (error) return VERIFY_ERROR;
    } catch {
      return VERIFY_ERROR;
    }
    router.replace("/admin");
    router.refresh();
    // Keeps the form pending until the route changes so a second tap cannot
    // resubmit a code that was already used.
    await navigatingAway();
  }

  return (
    <SharedMfaForm
      hasFactor={verifiedFactorId !== null}
      onEnrol={onEnrol}
      onVerify={onVerify}
      mapError={showCopy}
    />
  );
}

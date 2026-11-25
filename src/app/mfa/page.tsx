import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdminMember } from "@/lib/admin";
import { Wordmark } from "@/components/landing/wordmark";
import { AuthShell } from "@merqo/ui";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Two-step sign-in" };

// Lives outside /admin so the aal2 gate on /admin cannot loop back here.
export default async function MfaPage() {
  await requireAdminMember();
  const supabase = await createServerClient();
  const { data: level } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === "aal2") redirect("/admin");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp[0] ?? null;
  const staleFactorIds = (factors?.all ?? [])
    .filter((f) => f.factor_type === "totp" && f.status === "unverified")
    .map((f) => f.id);

  return (
    <AuthShell
      wordmark={<Wordmark className="text-xl" />}
      title="Two-step sign-in"
    >
      <MfaForm
        verifiedFactorId={verified?.id ?? null}
        staleFactorIds={staleFactorIds}
      />
    </AuthShell>
  );
}

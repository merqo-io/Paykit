import type { Metadata } from "next";
import { AuthConfirmForm, AuthConfirmInvalid, AuthShell } from "@merqo/ui";
import { readAuthConfirmParams } from "@merqo/ui/auth";

import { Wordmark } from "@/components/landing/wordmark";

export const metadata: Metadata = {
  title: "Confirm",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = readAuthConfirmParams(await searchParams);

  return (
    <AuthShell
      wordmark={<Wordmark className="text-xl" />}
      title="One more step"
    >
      {params ? (
        <AuthConfirmForm
          tokenHash={params.tokenHash}
          type={params.type}
          next={params.next}
        />
      ) : (
        <AuthConfirmInvalid />
      )}
    </AuthShell>
  );
}

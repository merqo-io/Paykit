import type { Metadata } from "next";
import { AcceptTermsPage, safeRedirectPath } from "@merqo/ui";
import { Wordmark } from "@/components/landing/wordmark";
import { acceptLegalTerms } from "./actions";

export const metadata: Metadata = {
  title: "Accept the updated terms",
};

export const revalidate = 0;

// Deliberately does NOT call any legal-gate check (getVendorSession) — this
// page is what that gate redirects TO, so gating it the same way is an
// infinite redirect loop. acceptLegalTerms (actions.ts) re-checks for a
// signed-in user on submit and sends a signed-out visitor to /login.
// AcceptTermsPage is a client component, so only serialisable props cross
// the boundary: no LinkComponent here.
export default async function LegalAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AcceptTermsPage
      action={acceptLegalTerms}
      next={safeRedirectPath(next, "/dashboard")}
      wordmark={<Wordmark className="text-xl" />}
      title="Our terms have changed"
      description="Read and accept them to continue."
    />
  );
}

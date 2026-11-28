import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { AcceptTermsPage, PageHeader, safeRedirectPath } from "@merqo/ui";
import { Wordmark } from "@/components/landing/wordmark";
import { acceptLegalTerms } from "./actions";

export const metadata: Metadata = {
  title: "Accept the updated terms",
};

export const revalidate = 0;

// Anything but the one known reason falls back to the terms-changed copy.
const reasonSchema = z.literal("unavailable").optional().catch(undefined);

// Deliberately does NOT call any legal-gate check (getVendorSession) — this
// page is what that gate redirects TO, so gating it the same way is an
// infinite redirect loop. acceptLegalTerms (actions.ts) re-checks for a
// signed-in user on submit and sends a signed-out visitor to /login.
// AcceptTermsPage is a client component, so only serialisable props cross
// the boundary: no LinkComponent here.
export default async function LegalAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  if (reasonSchema.parse(reason) === "unavailable") {
    // The vendor is still blocked: this only explains why, and the retry link
    // re-runs the gate against the original page.
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 py-10">
        <Wordmark className="text-xl" />
        <PageHeader
          title="We couldn't check the terms right now"
          description="This is a temporary problem on our side. Try again in a moment."
        />
        <Link
          href={safeRedirectPath(next, "/dashboard")}
          className="w-fit text-sm font-medium underline underline-offset-4"
        >
          Try again
        </Link>
        <p className="text-sm text-muted-foreground">
          If you were asked to review updated terms,{" "}
          <Link
            href={`/legal/accept?next=${encodeURIComponent(safeRedirectPath(next, "/dashboard"))}`}
            className="underline underline-offset-4"
          >
            review them here
          </Link>
          .
        </p>
      </main>
    );
  }

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

import Link from "next/link";
import { Footer } from "@merqo/ui";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * paykit's copy of the family footer: `@merqo/ui`'s shared `Footer` with
 * the paykit wordmark and tagline. The dashboard leaves the sign-in link
 * off, since everyone there is already signed in.
 */
export function SiteFooter({ showSignIn = false }: { showSignIn?: boolean }) {
  return (
    <Footer
      kitName="paykit"
      tagline="The Merqo family's shared vendor payment engine."
      showSignIn={showSignIn}
      wordmark={
        <Link
          href="/"
          aria-label="paykit home"
          className="transition-opacity hover:opacity-80"
        >
          <Wordmark className="text-xl" />
        </Link>
      }
    />
  );
}

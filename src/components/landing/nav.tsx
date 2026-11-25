import Link from "next/link";
import { LandingNav } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { Wordmark } from "./wordmark";
import { WAITLIST_URL } from "./waitlist";
import type { NavUser } from "@merqo/ui";
import { AccountNav } from "./account-nav";

export function Nav({ user }: { user?: NavUser | null }) {
  return (
    <LandingNav
      links={[
        { label: "About", href: "/about" },
        { label: "FAQ", href: "/faq" },
      ]}
      wordmark={
        <Link
          href="/"
          className="rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark className="text-3xl" />
          <span className="sr-only">paykit home</span>
        </Link>
      }
      end={
        <>
          {user ? (
            <AccountNav user={user} />
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden h-11 min-w-11 sm:inline-flex sm:h-8 sm:min-w-0"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="h-11 min-w-11 sm:h-8 sm:min-w-0"
              >
                <a href={WAITLIST_URL}>Join the waitlist</a>
              </Button>
            </>
          )}
        </>
      }
    />
  );
}

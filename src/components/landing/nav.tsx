import Link from "next/link";
import { LandingNav } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { Wordmark } from "./wordmark";
import { WAITLIST_URL } from "./waitlist";
import { LandingAccountNav } from "@merqo/ui";
import type { NavUser } from "@merqo/ui";
import { signOutAction } from "@/app/actions/auth";
import {
  submitLandingFeedback,
  submitLandingSupport,
} from "@/app/actions/landing-account";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";

export function Nav({ user }: { user?: NavUser | null }) {
  return (
    <LandingNav
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
          <Link
            href="/about"
            className="rounded-sm px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="rounded-sm px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            FAQ
          </Link>
          {user ? (
            <LandingAccountNav
              kit="paykit"
              dashboardHref="/dashboard"
              user={user}
              signOutAction={signOutAction}
              actions={{
                submitSupport: submitLandingSupport,
                submitFeedback: submitLandingFeedback,
              }}
              supportCategories={SUPPORT_CATEGORY_LABELS}
              LinkComponent={Link}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-sm px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Sign in
              </Link>
              <Button asChild size="sm">
                <a href={WAITLIST_URL}>Join the waitlist</a>
              </Button>
            </>
          )}
        </>
      }
    />
  );
}

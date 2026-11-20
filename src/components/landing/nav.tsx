import Link from "next/link";
import { LandingNav } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { Wordmark } from "./wordmark";
import { WAITLIST_URL } from "./waitlist";
import { LandingAccountMenu } from "./account-menu";

export type NavAccount = { name: string; avatarUrl?: string };

/** Display name and avatar from the auth user alone, so public pages need no profile lookup. */
export function navAccount(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): NavAccount {
  const meta = user.user_metadata ?? {};
  const full = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const avatar =
    typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
  return { name: full || user.email || "Account", avatarUrl: avatar };
}

export function Nav({
  authed = false,
  account,
}: {
  authed?: boolean;
  account?: NavAccount;
}) {
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
          {authed ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <LandingAccountMenu
                name={account?.name || "Account"}
                avatarUrl={account?.avatarUrl}
              />
            </>
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

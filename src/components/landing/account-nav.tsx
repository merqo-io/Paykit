"use client";

import Link from "next/link";
import { LandingAccountNav, type NavUser } from "@merqo/ui";

import { signOutAction } from "@/app/actions/auth";
import {
  submitLandingFeedback,
  submitLandingSupport,
} from "@/app/actions/landing-account";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";

// A Client Component because `LinkComponent` must be `next/link`, and in a
// Server Component `next/link` is a plain function that cannot be serialised
// into LandingAccountNav's props (HTTP 500 on every signed-in landing page).
export function AccountNav({ user }: { user: NavUser }) {
  return (
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
  );
}

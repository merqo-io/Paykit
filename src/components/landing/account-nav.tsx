"use client";

import { LandingAccountNav, type NavUser } from "@merqo/ui";

import { signOutAction } from "@/app/actions/auth";
import {
  submitLandingFeedback,
  submitLandingSupport,
} from "@/app/actions/landing-account";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";

// A Client Component because it hands server actions to LandingAccountNav;
// links come from the root `AppLinks` provider.
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
    />
  );
}

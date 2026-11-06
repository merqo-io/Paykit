"use client";
import { Wordmark } from "@/components/landing/wordmark";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardNav as SharedDashboardNav,
  getSwitchKits,
  TierChip,
} from "@merqo/ui";
import type { SupportMessageInput } from "@/lib/schemas";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { submitSupportMessageAction } from "@/app/actions/support";

type Tier = "free" | "pro";

const LINKS = [
  { href: "/dashboard/transactions", label: "Payments" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/reports", label: "Reports" },
];

function isActive(path: string, href: string): boolean {
  return href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
}

/** Stable anchor id for the onboarding tour, e.g. "/dashboard/transactions" -> "nav-transactions". */
function tourAnchor(href: string): string {
  return `nav-${href === "/dashboard" ? "dashboard" : href.split("/").pop()}`;
}

// Category list/labels for the nav's Get-help sheet.
const HELP_CATEGORIES: {
  value: SupportMessageInput["category"];
  label: string;
}[] = Object.entries(SUPPORT_CATEGORY_LABELS).map(([value, label]) => ({
  value: value as SupportMessageInput["category"],
  label,
}));

// @merqo/ui's getHelp.onSubmit types `category` as a bare `string | undefined`
// (it has no knowledge of paykit's own category literals), so narrow it back
// to SupportMessageInput["category"] by checking membership in the values
// HELP_CATEGORIES itself offers, instead of asserting the type.
const HELP_CATEGORY_VALUES: readonly string[] = HELP_CATEGORIES.map(
  (c) => c.value,
);
function isHelpCategory(
  value: string | undefined,
): value is SupportMessageInput["category"] {
  return value !== undefined && HELP_CATEGORY_VALUES.includes(value);
}

/**
 * Dashboard nav — composes `@merqo/ui`'s `DashboardNav`/`AccountMenu` for the
 * sticky header row (burger + inline links + account dropdown) instead of
 * hand-rolling it. This file now owns only paykit-specific bits: the
 * wordmark, the link list, active-route/tour-anchor logic, the tier badge,
 * and thin throw-adapting wrappers around
 * `submitFeedbackAction`/`submitSupportMessageAction` (both return a
 * `{success, error}` result rather than throwing, but the shared
 * component's `onSubmit` contract requires a promise that rejects on
 * failure so its own inline error UI can surface it).
 */
export function DashboardNav({
  signOut,
  vendorName,
  avatarUrl = null,
  plan,
}: {
  signOut: () => Promise<void>;
  vendorName: string;
  avatarUrl?: string | null;
  plan: Tier;
}) {
  const path = usePathname();

  return (
    <SharedDashboardNav
      wordmark={
        <Link
          href="/dashboard"
          aria-label="paykit dashboard home"
          className="font-display shrink-0 text-3xl font-semibold tracking-tight outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Wordmark className="text-3xl" />
        </Link>
      }
      navLinks={LINKS}
      LinkComponent={Link}
      isActiveHref={(href) => isActive(path, href)}
      tourAnchor={tourAnchor}
      vendor={{
        name: vendorName || "Account",
        avatarUrl: avatarUrl ?? undefined,
        tier: plan,
        // `subtitle` is the only line @merqo/ui's AccountMenu renders next
        // to the trigger and in the dropdown header, so it can't carry both
        // a generic descriptor and the vendor's real name — the actual
        // vendor name is far more useful here than a static label.
        subtitle: vendorName || "Your account",
      }}
      signOutAction={signOut}
      tierBadge={<TierChip tier={plan} />}
      showPlanItem
      extraLink={{ href: "/dashboard/config", label: "Payment setup" }}
      switchKits={getSwitchKits("paykit")}
      getHelp={{
        type: "form",
        onSubmit: async ({ message, category }) => {
          const res = await submitSupportMessageAction({
            category: isHelpCategory(category) ? category : "other",
            body: message,
          });
          if (!res.success) throw new Error(res.error);
        },
        categories: HELP_CATEGORIES,
      }}
      onFeedbackSubmit={async ({ message, nps }) => {
        const res = await submitFeedbackAction({
          nps: nps ?? 0,
          message: message.trim() || undefined,
        });
        if (!res.success) throw new Error(res.error);
      }}
      feedbackSource="vendor"
      feedbackMetric="nps"
      showNps
    />
  );
}

"use client";
import { Wordmark } from "@/components/landing/wordmark";

import { useState, useSyncExternalStore } from "react";
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
import {
  isActivePath,
  isLocked,
  isMoreActive,
  navItems,
  tourAnchor,
  type NavItem,
} from "@/lib/nav";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { MoreSheet } from "@/components/nav/more-sheet";
import { SideRail } from "@/components/nav/side-rail";
import type { NavLinkItem } from "@/components/nav/types";

type Tier = "free" | "pro";

// Inline top-bar links duplicate the rail, so they step aside at `lg`.
const LG_QUERY = "(min-width: 1024px)";

function subscribeLg(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(LG_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsLg(): boolean {
  return useSyncExternalStore(
    subscribeLg,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(LG_QUERY).matches,
    () => false,
  );
}

function toLinkItem(
  item: NavItem,
  plan: Tier,
  waitingCount: number,
): NavLinkItem {
  return {
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
    badge: item.key === "payments" ? waitingCount : undefined,
    badgeLabel: item.key === "payments" ? "waiting to confirm" : undefined,
    chip: isLocked(item, { plan }) ? <TierChip tier={item.tier} /> : undefined,
  };
}

/** Phone tab bar plus its More sheet; lives in the layout so it never remounts on navigation. */
export function DashboardTabBar({
  plan,
  waitingCount,
}: {
  plan: Tier;
  waitingCount: number;
}) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const ctx = { plan };
  const isActive = (href: string) => isActivePath(path, href);
  return (
    <>
      <BottomTabBar
        items={navItems("primary", ctx).map((i) =>
          toLinkItem(i, plan, waitingCount),
        )}
        isActive={isActive}
        moreActive={isMoreActive(path, ctx)}
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen(true)}
      />
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        items={navItems("more", ctx).map((i) =>
          toLinkItem(i, plan, waitingCount),
        )}
        isActive={isActive}
      />
    </>
  );
}

/** Desktop left rail (`lg` and up). */
export function DashboardRail({
  plan,
  waitingCount,
}: {
  plan: Tier;
  waitingCount: number;
}) {
  const path = usePathname();
  const isLg = useIsLg();
  const ctx = { plan };
  const items = [...navItems("primary", ctx), ...navItems("more", ctx)];
  return (
    <SideRail
      items={items.map((i) => toLinkItem(i, plan, waitingCount))}
      isActive={(href) => isActivePath(path, href)}
      anchorFor={isLg ? tourAnchor : undefined}
    />
  );
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
 * sticky header row (inline links from `sm` + account dropdown; no burger,
 * the phone navigates through the bottom tab bar) instead of
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
  const isLg = useIsLg();
  const inlineLinks = isLg
    ? []
    : navItems("primary", { plan })
        .filter((i) => i.key !== "home")
        .map((i) => ({ href: i.href, label: i.label }));

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
      navLinks={inlineLinks}
      mobileNav="none"
      isActiveHref={(href) => isActivePath(path, href)}
      tourAnchor={tourAnchor}
      vendor={{
        name: vendorName,
        avatarUrl: avatarUrl ?? undefined,
        tier: plan,
        // AccountMenu renders only `subtitle` beside the trigger, so it carries
        // the same label as `name`.
        subtitle: vendorName,
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

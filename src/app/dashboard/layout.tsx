import type { ReactNode } from "react";
import { accountLabel } from "@merqo/ui";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
import { signOutAction } from "@/app/actions/auth";
import { DashboardTour } from "@/components/dashboard-tour";
import { SiteFooter } from "@/components/site-footer";
import { claimedTxSummary } from "@/lib/transactions";
import { DashboardNav, DashboardRail, DashboardTabBar } from "./dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, user } = await getVendorSession();
  // Started before the profile reads so the tab-bar badge adds no round trip.
  const waitingPromise = claimedTxSummary(user.id);
  const [plan, profile, { data: prefs }] = await Promise.all([
    readVendorPlan(supabase, user.id),
    getOrCreateVendorProfile(supabase, user.id, null),
    supabase
      .from("vendor_prefs")
      .select("tour_seen_at")
      .eq("vendor_id", user.id)
      .maybeSingle(),
  ]);

  const waiting = await waitingPromise;

  // Profile icon lives on the auth user's metadata, same as qkit/loopkit —
  // no schema change needed.
  const rawAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatar === "string" ? rawAvatar : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/*
        @merqo/ui's DashboardNav renders its own <header> (sticky/border/
        padding already baked in) — this used to be paykit's own <header>
        wrapper before DashboardNav composed the shared component, but two
        <header> landmarks nested inside each other double the border/
        padding and are invalid semantics. A plain <div> keeps the one thing
        that <header> wasn't already covering (print:hidden) without adding
        a second landmark.

        `contents` is load-bearing, not decorative: the inner <header> is
        `position: sticky`, which is constrained to its containing block. A
        plain wrapper div's box IS that containing block, and it's exactly
        the header's own height, so the header would never have room to
        stick — it'd scroll away like a static element. `display: contents`
        removes the wrapper's own box from layout, so <header> becomes a
        direct child of this component's own `min-h-screen` container
        instead — the same containing block it had pre-migration, when
        paykit's own <header> was that child directly. `print:hidden` still
        wins under `@media print` since `display: none` on an ancestor
        hides descendants regardless of their own `display` value.
      */}
      <div className="contents print:hidden">
        <DashboardNav
          signOut={signOutAction}
          vendorName={accountLabel(user, profile.stall_name)}
          avatarUrl={avatarUrl}
          plan={plan ?? "free"}
        />
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <DashboardRail plan={plan ?? "free"} waitingCount={waiting.count} />
        {/* Bottom padding clears the fixed phone tab bar (3.5rem) and any
            anchored page action above it, plus the home-indicator inset. */}
        <main className="min-w-0 flex-1 px-5 py-7 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-7">
          {children}
        </main>
      </div>
      <DashboardTabBar plan={plan ?? "free"} waitingCount={waiting.count} />
      <div className="hidden sm:contents print:hidden">
        <SiteFooter />
      </div>
      <DashboardTour seen={!!prefs?.tour_seen_at} />
    </div>
  );
}

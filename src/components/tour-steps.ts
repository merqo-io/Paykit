// Pure step config for the dashboard onboarding tour. No driver.js import here
// so it stays node-unit-testable; the controller maps these to driver's Config.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransactionStatusBadge } from "@/app/dashboard/transactions/transaction-status-badge";

export type TourStep = {
  /** CSS selector for the element to spotlight. */
  element: string;
  title: string;
  description: string;
};

const sel = (tour: string) => `[data-tour="${tour}"]`;

// Renders the real badge, not a hand-copied color, so the example can't drift.
const exampleClaimedBadge = renderToStaticMarkup(
  createElement(TransactionStatusBadge, { status: "claimed" }),
);

// Desktop: nav links are visible, so we can spotlight each landmark.
const DESKTOP: TourStep[] = [
  {
    element: sel("tx-count"),
    title: "Your transaction activity",
    description:
      "Welcome to paykit. Once customers start paying, this card tracks how many transactions you've processed this month." +
      `<div class="tour-example"><div class="tour-example-label">Example transaction</div><div class="tour-example-row" style="margin-top:0.35rem"><strong>$4.80 &middot; via qkit</strong>${exampleClaimedBadge}</div></div>`,
  },
  {
    element: sel("nav-transactions"),
    title: "Payments",
    description:
      "Every checkout shows up here. When a customer pays, confirm it once you've checked the money actually landed.",
  },
  {
    element: sel("nav-bookings"),
    title: "Bookings",
    description:
      "Taking a deposit first and the rest later, for weddings, events, or anything booked in advance? Track the deposit and balance here, with reschedule and cancel built in.",
  },
  {
    element: sel("nav-stats"),
    title: "Reports",
    description:
      "Track your revenue and payment volume over time, and see earnings by month.",
  },
  {
    element: sel("nav-account"),
    title: "Your account",
    description:
      "Start here: open Payment setup to add your PayNow details or your own payment link and QR. Your profile, plan and help are in this menu too.",
  },
  {
    element: sel("tour-replay"),
    title: "Replay anytime",
    description:
      "Tap here to run this tour again whenever you like. Ready? Open the account menu and set up your payment method.",
  },
];

// Mobile: nav is collapsed behind the hamburger, so spotlight that instead of
// the hidden links (driver can't highlight an off-screen element).
const MOBILE: TourStep[] = [
  DESKTOP[0],
  {
    element: sel("nav-menu"),
    title: "Your sections",
    description:
      "Payments, Bookings and Reports live in here. Open your account menu and choose Payment setup to accept your first payment.",
  },
  DESKTOP[DESKTOP.length - 1],
];

/** The tour steps for the current layout. */
export function tourSteps(isMobile: boolean): TourStep[] {
  return isMobile ? MOBILE : DESKTOP;
}

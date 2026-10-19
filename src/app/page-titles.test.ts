import type { Metadata } from "next";
import { describe, it, expect } from "vitest";

type MetadataModule = { metadata?: Metadata };

const PAGES: [string, () => Promise<MetadataModule>, string][] = [
  ["/dashboard", () => import("./dashboard/page"), "Dashboard"],
  [
    "/dashboard/bookings",
    () => import("./dashboard/bookings/page"),
    "Bookings",
  ],
  [
    "/dashboard/bookings/[id]",
    () => import("./dashboard/bookings/[id]/page"),
    "Booking",
  ],
  [
    "/dashboard/config",
    () => import("./dashboard/config/page"),
    "Payment setup",
  ],
  ["/dashboard/plan", () => import("./dashboard/plan/page"), "Plan"],
  ["/dashboard/profile", () => import("./dashboard/profile/page"), "Profile"],
  [
    "/dashboard/reports/earnings",
    () => import("./dashboard/reports/earnings/page"),
    "Earnings report",
  ],
  ["/dashboard/stats", () => import("./dashboard/stats/page"), "Stats"],
  [
    "/dashboard/transactions",
    () => import("./dashboard/transactions/page"),
    "Transactions",
  ],
  ["/admin", () => import("./admin/page"), "Admin overview"],
  ["/admin/vendors", () => import("./admin/vendors/page"), "Vendors"],
  ["/admin/activity", () => import("./admin/activity/page"), "Activity"],
  ["not-found", () => import("./not-found"), "Page not found"],
  ["/about", () => import("./about/page"), "About"],
  ["/login", () => import("./login/layout"), "Sign in"],
  ["/pay/[id]", () => import("./pay/[id]/page"), "Pay"],
  [
    "/legal/accept",
    () => import("./legal/accept/page"),
    "Accept the updated terms",
  ],
  ["/legal/terms", () => import("./legal/terms/page"), "Terms of Service"],
  ["/legal/privacy", () => import("./legal/privacy/page"), "Privacy Policy"],
];

describe("page titles", () => {
  it.each(PAGES)("%s has its own title", async (_route, load, title) => {
    const { metadata } = await load();
    expect(metadata?.title).toBe(title);
  });
});

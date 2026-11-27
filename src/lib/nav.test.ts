import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  isActivePath,
  isLocked,
  isMoreActive,
  navItems,
  type NavItem,
} from "./nav";

const free = { plan: "free" as const };

describe("nav config", () => {
  it("puts Home, Payments, Bookings, Reports on the tab bar in that order", () => {
    expect(navItems("primary", free).map((i) => i.label)).toEqual([
      "Home",
      "Payments",
      "Bookings",
      "Reports",
    ]);
  });

  it("keeps Payment setup, Profile and Plan in More", () => {
    expect(navItems("more", free).map((i) => i.label)).toEqual([
      "Payment setup",
      "Profile",
      "Plan",
    ]);
  });

  it("has unique keys and hrefs", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.key)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });

  it("drops items whose showWhen is false", () => {
    const items: NavItem[] = [
      { ...NAV_ITEMS[0], key: "a", showWhen: () => false },
      { ...NAV_ITEMS[0], key: "b", showWhen: ({ plan }) => plan === "pro" },
      { ...NAV_ITEMS[0], key: "c" },
    ];
    expect(navItems("primary", free, items).map((i) => i.key)).toEqual(["c"]);
    expect(
      navItems("primary", { plan: "pro" }, items).map((i) => i.key),
    ).toEqual(["b", "c"]);
  });

  it("locks only pro items for free vendors", () => {
    const proItem: NavItem = { ...NAV_ITEMS[0], tier: "pro" };
    expect(isLocked(proItem, free)).toBe(true);
    expect(isLocked(proItem, { plan: "pro" })).toBe(false);
    expect(isLocked(NAV_ITEMS[0], free)).toBe(false);
  });
});

describe("isActivePath", () => {
  it("matches Home only on the exact route", () => {
    expect(isActivePath("/dashboard", "/dashboard")).toBe(true);
    expect(isActivePath("/dashboard/plan", "/dashboard")).toBe(false);
  });

  it("matches sub-routes but not look-alike prefixes", () => {
    expect(isActivePath("/dashboard/bookings/abc", "/dashboard/bookings")).toBe(
      true,
    );
    expect(isActivePath("/dashboard/bookings-old", "/dashboard/bookings")).toBe(
      false,
    );
  });
});

describe("isMoreActive", () => {
  it("is true on pages owned by the More sheet only", () => {
    expect(isMoreActive("/dashboard/profile", free)).toBe(true);
    expect(isMoreActive("/dashboard/transactions", free)).toBe(false);
  });
});

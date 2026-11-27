import {
  CalendarDays,
  CreditCard,
  Home,
  LineChart,
  Settings,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavTier = "free" | "pro";

/** "primary" items fill the phone tab bar and the desktop rail; "more" items live in the More sheet. */
export type NavPlacement = "primary" | "more";

export interface NavContext {
  plan: NavTier;
}

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** The plan the section needs; "pro" items stay listed for Free vendors, marked locked. */
  tier: NavTier;
  placement: NavPlacement;
  children?: NavItem[];
  showWhen?: (ctx: NavContext) => boolean;
}

/**
 * The single source for the phone tab bar, the desktop rail and the More
 * sheet. Phase 2 sections are added here only once their routes exist.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    href: "/dashboard",
    tier: "free",
    placement: "primary",
  },
  {
    key: "payments",
    label: "Payments",
    icon: CreditCard,
    href: "/dashboard/transactions",
    tier: "free",
    placement: "primary",
  },
  {
    key: "bookings",
    label: "Bookings",
    icon: CalendarDays,
    href: "/dashboard/bookings",
    tier: "free",
    placement: "primary",
  },
  {
    key: "reports",
    label: "Reports",
    icon: LineChart,
    href: "/dashboard/reports",
    tier: "free",
    placement: "primary",
  },
  {
    key: "config",
    label: "Payment setup",
    icon: Wallet,
    href: "/dashboard/config",
    tier: "free",
    placement: "more",
  },
  {
    key: "profile",
    label: "Profile",
    icon: UserRound,
    href: "/dashboard/profile",
    tier: "free",
    placement: "more",
  },
  {
    key: "plan",
    label: "Plan",
    icon: Settings,
    href: "/dashboard/plan",
    tier: "free",
    placement: "more",
  },
];

/** Items of one placement that apply to this vendor, in config order. */
export function navItems(
  placement: NavPlacement,
  ctx: NavContext,
  items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
  return items.filter(
    (item) => item.placement === placement && (item.showWhen?.(ctx) ?? true),
  );
}

/** True when a Free vendor sees the item but cannot use it. */
export function isLocked(item: NavItem, ctx: NavContext): boolean {
  return item.tier === "pro" && ctx.plan === "free";
}

/** Home matches only itself; every other href also matches its sub-routes. */
export function isActivePath(path: string, href: string): boolean {
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}

/** The More trigger reads as current on any page the sheet owns. */
export function isMoreActive(path: string, ctx: NavContext): boolean {
  return navItems("more", ctx).some((item) => isActivePath(path, item.href));
}

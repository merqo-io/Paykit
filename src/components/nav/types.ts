import type { ComponentType, ReactNode } from "react";

/** What the nav components render; they know nothing of paykit's nav config. */
export interface NavLinkItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Count shown as a badge; hidden at 0. */
  badge?: number;
  /** Screen-reader text after the count, e.g. "waiting to confirm". */
  badgeLabel?: string;
  /** Trailing marker such as a plan chip for a locked section. */
  chip?: ReactNode;
}

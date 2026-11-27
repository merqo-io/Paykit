"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@merqo/ui/primitives";
import type { NavLinkItem } from "./types";

const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

/**
 * The phone's "everything else" drawer: setup and housekeeping pages plus the
 * legal links the footer carries on larger screens. Account actions (help,
 * feedback, switch kit, sign out) stay in the header's account menu.
 */
export function MoreSheet({
  open,
  onOpenChange,
  items,
  isActive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly NavLinkItem[];
  isActive: (href: string) => boolean;
}) {
  const close = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Setup, profile and plan.</SheetDescription>
        </SheetHeader>
        <ul className="px-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-base font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-primary"
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.chip}
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <nav
          aria-label="Legal"
          className="mt-2 flex flex-wrap gap-x-4 border-t px-4 pt-2 pb-4 text-sm text-muted-foreground"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="inline-flex min-h-11 items-center hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

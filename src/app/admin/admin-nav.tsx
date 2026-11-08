"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@merqo/ui/primitives";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/activity", label: "Activity" },
];

/** Admin section tabs. Overview matches exactly; others match by prefix. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Admin sections"
      className="mx-auto flex max-w-5xl gap-1 px-5 pt-2"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

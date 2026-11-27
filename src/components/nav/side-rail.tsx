import Link from "next/link";
import { cn } from "@merqo/ui/primitives";
import type { NavLinkItem } from "./types";

/**
 * Desktop navigation from `lg`: a left rail carrying the same destinations as
 * the tab bar, sticky below the top bar. Hidden below `lg` and in print.
 */
export function SideRail({
  items,
  isActive,
}: {
  items: readonly NavLinkItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <aside className="hidden w-56 shrink-0 border-r lg:block print:hidden">
      <nav aria-label="Sections" className="sticky top-20 px-3 py-7">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="sr-only">
                      , {item.badge} {item.badgeLabel}
                    </span>
                  ) : null}
                  {item.badge ? (
                    <span
                      aria-hidden
                      className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                  {item.chip}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { cn } from "@merqo/ui/primitives";
import { TAB_BAR_HEIGHT } from "./tab-bar-height";
import type { NavLinkItem } from "./types";

const TAB_CLASS =
  "relative flex w-full flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50";

function tabTone(active: boolean): string {
  return active
    ? "text-primary"
    : "text-muted-foreground active:text-foreground";
}

/**
 * Phone navigation: icon-plus-label tabs fixed to the bottom edge, the reach
 * zone for one-handed use. The last slot opens the More sheet. Hidden from
 * `lg` up, where the rail takes over, and in print.
 */
export function BottomTabBar({
  items,
  isActive,
  moreActive,
  moreOpen,
  onMoreClick,
}: {
  items: readonly NavLinkItem[];
  isActive: (href: string) => boolean;
  moreActive: boolean;
  moreOpen: boolean;
  onMoreClick: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{ minHeight: TAB_BAR_HEIGHT }}
                className={cn(TAB_CLASS, tabTone(active))}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {item.badge ? (
                    <span
                      aria-hidden
                      className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-semibold text-primary-foreground"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="sr-only">
                    , {item.badge} {item.badgeLabel}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? "page" : undefined}
            onClick={onMoreClick}
            style={{ minHeight: TAB_BAR_HEIGHT }}
            className={cn(TAB_CLASS, tabTone(moreActive || moreOpen))}
          >
            <Ellipsis aria-hidden className="size-6" />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

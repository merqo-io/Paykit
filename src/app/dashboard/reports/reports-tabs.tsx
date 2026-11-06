import Link from "next/link";
import { cn } from "@/lib/utils";
import { reportsHref, type ReportTab } from "./search-params";

const TABS: { tab: ReportTab; label: string }[] = [
  { tab: "overview", label: "Overview" },
  { tab: "earnings", label: "Earnings" },
];

/** Plain links rather than client state so each tab is server-rendered and deep-linkable. */
export function ReportsTabs({ active }: { active: ReportTab }) {
  return (
    <nav
      aria-label="Report sections"
      className="mb-6 flex gap-1 border-b border-border"
    >
      {TABS.map(({ tab, label }) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={reportsHref(tab)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isActive
                ? "border-mint text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

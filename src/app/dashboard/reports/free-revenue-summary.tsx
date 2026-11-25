import { ProLock, StatCard } from "@merqo/ui";
import type { DayTotal } from "@/lib/free-limits";
import { formatCents } from "@/lib/utils";

export const FREE_REVENUE_LOCK_LABEL =
  "See weekly and monthly revenue and your best days, included with Starter and Pro";

export function FreeRevenueSummary({
  today,
  yesterday,
}: {
  today: DayTotal;
  yesterday: DayTotal;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today"
          value={formatCents(today.cents)}
          className="tabular-nums"
        />
        <StatCard
          label="Yesterday"
          value={formatCents(yesterday.cents)}
          className="tabular-nums"
        />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {today.count} payment{today.count === 1 ? "" : "s"} today,{" "}
        {yesterday.count} yesterday.
      </p>
      <ProLock label={FREE_REVENUE_LOCK_LABEL} href="/dashboard/plan" />
    </div>
  );
}

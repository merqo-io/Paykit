import { ProLock, StatCard, formatMoney } from "@merqo/ui";
import type { DayTotal } from "@/lib/free-limits";

export const FREE_REVENUE_LOCK_LABEL =
  "See weekly and monthly revenue and your best days. Included with Starter and Pro.";

const paymentCount = (n: number) => `${n} payment${n === 1 ? "" : "s"}`;

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
          value={formatMoney(today.cents)}
          caption={paymentCount(today.count)}
          className="tabular-nums"
        />
        <StatCard
          label="Yesterday"
          value={formatMoney(yesterday.cents)}
          caption={paymentCount(yesterday.count)}
          className="tabular-nums"
        />
      </div>
      <ProLock label={FREE_REVENUE_LOCK_LABEL} href="/dashboard/plan" />
    </div>
  );
}

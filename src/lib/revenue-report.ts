import { sgtDate } from "@/lib/free-limits";
import type { Transaction } from "@/lib/types";

export type DailyRevenue = { date: string; cents: number; count: number };

/** Aggregates confirmed transactions into per-day totals + counts (Singapore date, sorted ascending). Non-confirmed transactions are excluded — they haven't become revenue yet. `count` feeds the stats page's transaction-count tile, so it stays derived here rather than requiring a second pass over `transactions` at the call site. */
export function aggregateRevenueByDay(
  transactions: Transaction[],
): DailyRevenue[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    const date = sgtDate(tx.created_at);
    const prior = totals.get(date) ?? { cents: 0, count: 0 };
    totals.set(date, {
      cents: prior.cents + tx.amount_cents,
      count: prior.count + 1,
    });
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { cents, count }]) => ({ date, cents, count }));
}

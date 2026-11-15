import type { VendorPlan } from "@/lib/types";

export const FREE_LIST_DAYS = 30;

const DAY_MS = 86_400_000;
const SGT_OFFSET_MS = 8 * 3_600_000;

/** An unreadable plan counts as free so a failed read never opens paid data. */
export function isPaidPlan(plan: VendorPlan | null): boolean {
  return plan === "pro";
}

/** Earliest `created_at` a Free vendor's transaction list may show. */
export function freeListCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - FREE_LIST_DAYS * DAY_MS).toISOString();
}

export type FreeRevenueWindow = {
  /** Start of today, Singapore time. */
  todayStartIso: string;
  /** Start of yesterday, Singapore time. */
  startIso: string;
  /** Start of tomorrow, Singapore time. */
  endIso: string;
};

export function freeRevenueWindow(now: Date = new Date()): FreeRevenueWindow {
  const todayStartMs =
    Math.floor((now.getTime() + SGT_OFFSET_MS) / DAY_MS) * DAY_MS -
    SGT_OFFSET_MS;
  return {
    todayStartIso: new Date(todayStartMs).toISOString(),
    startIso: new Date(todayStartMs - DAY_MS).toISOString(),
    endIso: new Date(todayStartMs + DAY_MS).toISOString(),
  };
}

export type DayTotal = { cents: number; count: number };

/** Confirmed revenue for today and yesterday (SGT); rows outside that window are ignored. */
export function sumFreeRevenue(
  transactions: { status: string; amount_cents: number; created_at: string }[],
  now: Date = new Date(),
): { today: DayTotal; yesterday: DayTotal } {
  const { todayStartIso, startIso, endIso } = freeRevenueWindow(now);
  const todayStart = Date.parse(todayStartIso);
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const totals = {
    today: { cents: 0, count: 0 },
    yesterday: { cents: 0, count: 0 },
  };
  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    const at = Date.parse(tx.created_at);
    if (at < start || at >= end) continue;
    const bucket = at >= todayStart ? totals.today : totals.yesterday;
    bucket.cents += tx.amount_cents;
    bucket.count += 1;
  }
  return totals;
}

import type { VendorPlan } from "@/lib/types";

export const FREE_LIST_DAYS = 30;

const DAY_MS = 86_400_000;
const SGT_OFFSET_MS = 8 * 3_600_000;

/** Singapore calendar date (YYYY-MM-DD) of an ISO timestamp; Singapore has no DST. */
export function sgtDate(iso: string): string {
  return new Date(Date.parse(iso) + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

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

/** Start of a Singapore calendar day (YYYY-MM-DD) as a UTC ISO timestamp. */
export function sgtDayStartIso(date: string): string {
  return new Date(
    Date.parse(`${date}T00:00:00.000Z`) - SGT_OFFSET_MS,
  ).toISOString();
}

/** Start of the Singapore day after `date`, the exclusive end of a "to" filter. */
export function sgtNextDayStartIso(date: string): string {
  return new Date(Date.parse(sgtDayStartIso(date)) + DAY_MS).toISOString();
}

export type ListRange = {
  /** Inclusive lower bound on `created_at`. */
  gteIso?: string;
  /** Exclusive upper bound on `created_at`. */
  ltIso?: string;
  /**
   * The lower bound is Free's history cutoff, not a vendor-chosen date, so
   * claimed rows (payments the vendor still has to confirm) stay listed
   * however old they are.
   */
  keepClaimed?: boolean;
};

/**
 * The `created_at` window a ledger query may use. Free is floored at the
 * 30-day cutoff whatever `from` says, so a crafted URL can never reach older
 * rows; paid vendors get exactly the requested window.
 */
export function resolveListRange(
  isPaid: boolean,
  filters: { from?: string; to?: string },
  now: Date = new Date(),
): ListRange {
  const requested = filters.from ? sgtDayStartIso(filters.from) : undefined;
  const ltIso = filters.to ? sgtNextDayStartIso(filters.to) : undefined;
  if (isPaid) return { gteIso: requested, ltIso };
  const cutoff = freeListCutoff(now);
  const gteIso = requested && requested > cutoff ? requested : cutoff;
  return { gteIso, ltIso, keepClaimed: gteIso === cutoff };
}

import { describe, expect, it } from "vitest";
import {
  freeListCutoff,
  freeRevenueWindow,
  isPaidPlan,
  sgtDate,
  sumFreeRevenue,
} from "./free-limits";

const NOW = new Date("2026-11-16T02:00:00Z");

const tx = (created_at: string, amount_cents = 100, status = "confirmed") => ({
  status,
  amount_cents,
  created_at,
});

describe("isPaidPlan", () => {
  it("is true only for pro; free and an unreadable plan are not paid", () => {
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
  });
});

describe("freeListCutoff", () => {
  it("is 30 days before now", () => {
    expect(freeListCutoff(NOW)).toBe("2026-10-17T02:00:00.000Z");
  });
});

describe("freeRevenueWindow", () => {
  it("bounds yesterday and today by Singapore midnight", () => {
    expect(freeRevenueWindow(NOW)).toEqual({
      todayStartIso: "2026-11-15T16:00:00.000Z",
      startIso: "2026-11-14T16:00:00.000Z",
      endIso: "2026-11-16T16:00:00.000Z",
    });
  });

  it("rolls to the next Singapore date at 16:00 UTC", () => {
    const justAfter = freeRevenueWindow(new Date("2026-11-16T16:00:00Z"));
    expect(justAfter.todayStartIso).toBe("2026-11-16T16:00:00.000Z");
  });
});

describe("sumFreeRevenue", () => {
  it("splits today and yesterday by Singapore date", () => {
    const totals = sumFreeRevenue(
      [
        tx("2026-11-15T16:00:00Z", 500),
        tx("2026-11-16T01:00:00Z", 250),
        tx("2026-11-15T15:59:00Z", 300),
      ],
      NOW,
    );
    expect(totals.today).toEqual({ cents: 750, count: 2 });
    expect(totals.yesterday).toEqual({ cents: 300, count: 1 });
  });

  it("keeps 23:59 SGT yesterday and drops 23:59 SGT two days ago", () => {
    const totals = sumFreeRevenue(
      [tx("2026-11-15T15:59:00Z", 100), tx("2026-11-14T15:59:00Z", 900)],
      NOW,
    );
    expect(totals.yesterday).toEqual({ cents: 100, count: 1 });
    expect(totals.today).toEqual({ cents: 0, count: 0 });
  });

  it("includes 00:00 SGT yesterday and excludes the next Singapore date", () => {
    const totals = sumFreeRevenue(
      [tx("2026-11-14T16:00:00Z", 100), tx("2026-11-16T16:00:00Z", 900)],
      NOW,
    );
    expect(totals.yesterday.cents).toBe(100);
    expect(totals.today.cents).toBe(0);
  });

  it("ignores unconfirmed transactions", () => {
    const totals = sumFreeRevenue(
      [tx("2026-11-16T01:00:00Z", 100, "pending")],
      NOW,
    );
    expect(totals.today).toEqual({ cents: 0, count: 0 });
  });
});

describe("sgtDate", () => {
  it("keeps 15:59 UTC on the same Singapore day as 23:59 SGT and moves 16:00 UTC to the next", () => {
    expect(sgtDate("2026-11-16T15:59:00Z")).toBe("2026-11-16");
    expect(sgtDate("2026-11-16T16:00:00Z")).toBe("2026-11-17");
  });

  it("rolls the month and year over at 16:00 UTC", () => {
    expect(sgtDate("2026-11-30T16:00:00Z")).toBe("2026-12-01");
    expect(sgtDate("2026-12-31T16:00:00Z")).toBe("2027-01-01");
  });

  it("agrees with the Free window start", () => {
    const { todayStartIso } = freeRevenueWindow(NOW);
    expect(sgtDate(todayStartIso)).toBe("2026-11-16");
  });
});

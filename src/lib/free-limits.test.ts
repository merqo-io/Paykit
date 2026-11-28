import { sgDayKey } from "@merqo/ui";
import { describe, expect, it } from "vitest";
import {
  freeListCutoff,
  freeRevenueWindow,
  isPaidPlan,
  resolveListRange,
  sgtDayStartIso,
  sgtNextDayStartIso,
  sumFreeRevenue,
} from "./free-limits";

describe("sgtDayStartIso / sgtNextDayStartIso", () => {
  it("maps a Singapore date to its UTC start and next-day start", () => {
    expect(sgtDayStartIso("2026-11-25")).toBe("2026-11-24T16:00:00.000Z");
    expect(sgtNextDayStartIso("2026-11-25")).toBe("2026-11-25T16:00:00.000Z");
  });
});

describe("resolveListRange", () => {
  const now = new Date("2026-11-25T04:00:00Z");
  const cutoff = freeListCutoff(now);

  it("leaves a paid vendor's window exactly as requested", () => {
    expect(resolveListRange(true, {}, now)).toEqual({
      gteIso: undefined,
      ltIso: undefined,
    });
    expect(
      resolveListRange(true, { from: "2020-01-01", to: "2020-01-31" }, now),
    ).toEqual({
      gteIso: "2019-12-31T16:00:00.000Z",
      ltIso: "2020-01-31T16:00:00.000Z",
    });
  });

  it("floors a Free vendor at the cutoff when no from is given", () => {
    expect(resolveListRange(false, {}, now).gteIso).toBe(cutoff);
  });

  it("never lets a Free vendor reach past the cutoff via from", () => {
    expect(resolveListRange(false, { from: "2020-01-01" }, now).gteIso).toBe(
      cutoff,
    );
  });

  it("keeps a Free from that is newer than the cutoff", () => {
    expect(resolveListRange(false, { from: "2026-11-20" }, now).gteIso).toBe(
      "2026-11-19T16:00:00.000Z",
    );
  });

  it("lets claimed rows through the cutoff for Free, never for paid", () => {
    expect(resolveListRange(false, {}, now).keepClaimed).toBe(true);
    expect(resolveListRange(false, { from: "2020-01-01" }, now)).toMatchObject({
      gteIso: cutoff,
      keepClaimed: true,
    });
    expect(resolveListRange(true, {}, now).keepClaimed).toBeUndefined();
    expect(
      resolveListRange(true, { from: "2020-01-01" }, now).keepClaimed,
    ).toBeUndefined();
  });

  it("does not keep claimed rows past a Free from the vendor chose", () => {
    expect(
      resolveListRange(false, { from: "2026-11-20" }, now).keepClaimed,
    ).toBe(false);
  });

  it("keeps the floor even when to is before the cutoff", () => {
    const range = resolveListRange(false, { to: "2020-01-31" }, now);
    expect(range.gteIso).toBe(cutoff);
    expect(range.ltIso! <= range.gteIso!).toBe(true);
  });
});

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

describe("sgDayKey against the Free window", () => {
  it("keeps 15:59 UTC on the same Singapore day as 23:59 SGT and moves 16:00 UTC to the next", () => {
    expect(sgDayKey("2026-11-16T15:59:00Z")).toBe("2026-11-16");
    expect(sgDayKey("2026-11-16T16:00:00Z")).toBe("2026-11-17");
  });

  it("rolls the month and year over at 16:00 UTC", () => {
    expect(sgDayKey("2026-11-30T16:00:00Z")).toBe("2026-12-01");
    expect(sgDayKey("2026-12-31T16:00:00Z")).toBe("2027-01-01");
  });

  it("agrees with the Free window start", () => {
    const { todayStartIso } = freeRevenueWindow(NOW);
    expect(sgDayKey(todayStartIso)).toBe("2026-11-16");
  });
});

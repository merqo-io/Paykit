import { describe, it, expect } from "vitest";
import { formatDate } from "@merqo/ui";
import { pctChange } from "./utils";

describe("pctChange", () => {
  it("is null when there is no prior period", () => {
    expect(pctChange(5, 0)).toBeNull();
  });

  it("computes the percent change against the prior period", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });
});

// Postgres `date` columns ("YYYY-MM-DD") are passed straight to the shared
// formatter; a bare date parses as UTC midnight, which is 08:00 in SGT, so
// the calendar day must never shift.
describe("shared formatDate on bare Postgres dates", () => {
  it("keeps the calendar day", () => {
    expect(formatDate("2026-11-07")).toBe("7 Nov 2026");
  });

  it("does not shift month or year boundaries", () => {
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDate("2026-03-01")).toBe("1 Mar 2026");
  });
});

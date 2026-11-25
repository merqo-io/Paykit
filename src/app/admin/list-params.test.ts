import { describe, expect, it } from "vitest";
import {
  dayBounds,
  listHref,
  paginate,
  parseActivityParams,
  parseVendorParams,
} from "./list-params";

describe("parseVendorParams", () => {
  it("defaults to an empty search on page 1", () => {
    expect(parseVendorParams({})).toEqual({ q: "", page: 1 });
  });

  it("trims q, takes the first of repeated values and parses page", () => {
    expect(parseVendorParams({ q: ["  kopi ", "x"], page: "3" })).toEqual({
      q: "kopi",
      page: 3,
    });
  });

  it("falls back on a bad page or an over-long q", () => {
    expect(parseVendorParams({ page: "abc" }).page).toBe(1);
    expect(parseVendorParams({ page: "-4" }).page).toBe(1);
    expect(parseVendorParams({ page: "2.5" }).page).toBe(1);
    expect(parseVendorParams({ q: "a".repeat(101) }).q).toBe("");
  });
});

describe("parseActivityParams", () => {
  it("defaults to no filters", () => {
    expect(parseActivityParams({})).toEqual({
      action: "",
      from: "",
      to: "",
      page: 1,
    });
  });

  it("accepts valid filters", () => {
    expect(
      parseActivityParams({
        action: "record_refund",
        from: "2026-08-01",
        to: "2026-08-31",
        page: "2",
      }),
    ).toEqual({
      action: "record_refund",
      from: "2026-08-01",
      to: "2026-08-31",
      page: 2,
    });
  });

  it("drops malformed or impossible dates", () => {
    const parsed = parseActivityParams({ from: "yesterday", to: "2026-13-45" });
    expect(parsed.from).toBe("");
    expect(parsed.to).toBe("");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 53 }, (_, i) => i);

  it("slices a page and reports the exact total", () => {
    const paged = paginate(items, 2);
    expect(paged.rows).toHaveLength(25);
    expect(paged.rows[0]).toBe(25);
    expect(paged).toMatchObject({ page: 2, pageCount: 3, total: 53 });
    expect(paged.overflow).toBe(false);
  });

  it("flags a page past the end and returns the last page", () => {
    const paged = paginate(items, 9);
    expect(paged.overflow).toBe(true);
    expect(paged.page).toBe(3);
    expect(paged.rows).toHaveLength(3);
  });

  it("treats an empty list as one empty page", () => {
    expect(paginate([], 1)).toMatchObject({
      rows: [],
      pageCount: 1,
      total: 0,
      overflow: false,
    });
  });
});

describe("listHref", () => {
  it("drops empty values and the first page", () => {
    expect(listHref("/x", { q: "", page: 1 })).toBe("/x");
    expect(listHref("/x", { q: "a b", page: 2 })).toBe("/x?q=a+b&page=2");
  });
});

describe("dayBounds", () => {
  it("is unbounded when empty and covers whole Singapore days", () => {
    expect(dayBounds("", "")).toEqual({ fromMs: -Infinity, toMs: Infinity });
    const { fromMs, toMs } = dayBounds("2026-08-21", "2026-08-21");
    expect(fromMs).toBe(Date.parse("2026-08-20T16:00:00Z"));
    expect(toMs).toBe(Date.parse("2026-08-21T15:59:59.999Z"));
  });
});

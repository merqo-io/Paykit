import { describe, expect, it } from "vitest";
import { parseTransactionsParams, transactionsHref } from "./search-params";

describe("parseTransactionsParams", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseTransactionsParams({})).toEqual({
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("accepts valid values and takes the first of repeated params", () => {
    expect(
      parseTransactionsParams({
        q: ["  A-001 ", "x"],
        status: "claimed",
        from: "2026-11-01",
        to: "2026-11-25",
        page: "3",
      }),
    ).toEqual({
      q: "A-001",
      status: "claimed",
      from: "2026-11-01",
      to: "2026-11-25",
      page: 3,
    });
  });

  it("drops invalid values instead of failing", () => {
    expect(
      parseTransactionsParams({
        q: "",
        status: "refunded",
        from: "2026-02-31",
        to: "yesterday",
        page: "-4",
      }),
    ).toEqual({
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("drops an over-long search", () => {
    expect(parseTransactionsParams({ q: "a".repeat(81) }).q).toBeUndefined();
  });
});

describe("transactionsHref", () => {
  it("omits unset filters and page 1", () => {
    expect(transactionsHref({ page: 1 })).toBe("/dashboard/transactions");
  });

  it("encodes the set filters", () => {
    expect(
      transactionsHref({
        q: "a b",
        status: "claimed",
        from: "2026-11-01",
        to: "2026-11-02",
        page: 2,
      }),
    ).toBe(
      "/dashboard/transactions?q=a+b&status=claimed&from=2026-11-01&to=2026-11-02&page=2",
    );
  });
});

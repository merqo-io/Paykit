import { describe, expect, it } from "vitest";
import {
  bookingListHref,
  hasActiveFilters,
  parseBookingListParams,
} from "./list-params";

describe("parseBookingListParams", () => {
  it("defaults to no filters on page 1", () => {
    expect(parseBookingListParams({})).toEqual({
      q: "",
      status: null,
      page: 1,
    });
  });

  it("trims and caps the search text", () => {
    expect(parseBookingListParams({ q: "  Jane  " }).q).toBe("Jane");
    expect(parseBookingListParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });

  it("accepts a known status and drops an unknown one", () => {
    expect(parseBookingListParams({ status: "fully_paid" }).status).toBe(
      "fully_paid",
    );
    expect(parseBookingListParams({ status: "bogus" }).status).toBeNull();
  });

  it("falls back to page 1 for bad page values", () => {
    expect(parseBookingListParams({ page: "3" }).page).toBe(3);
    expect(parseBookingListParams({ page: "0" }).page).toBe(1);
    expect(parseBookingListParams({ page: "abc" }).page).toBe(1);
    expect(parseBookingListParams({ page: "1.5" }).page).toBe(1);
  });

  it("uses the first value of a repeated param", () => {
    const p = parseBookingListParams({ q: ["a", "b"], status: ["cancelled"] });
    expect(p.q).toBe("a");
    expect(p.status).toBe("cancelled");
  });
});

describe("hasActiveFilters", () => {
  it("is true for search or status, not for page", () => {
    expect(hasActiveFilters({ q: "", status: null, page: 4 })).toBe(false);
    expect(hasActiveFilters({ q: "a", status: null, page: 1 })).toBe(true);
    expect(hasActiveFilters({ q: "", status: "cancelled", page: 1 })).toBe(
      true,
    );
  });
});

describe("bookingListHref", () => {
  it("omits defaults", () => {
    expect(bookingListHref({})).toBe("/dashboard/bookings");
    expect(bookingListHref({ page: 1 })).toBe("/dashboard/bookings");
  });

  it("encodes set params", () => {
    expect(bookingListHref({ q: "a b", status: "deposit_paid", page: 2 })).toBe(
      "/dashboard/bookings?q=a+b&status=deposit_paid&page=2",
    );
  });
});

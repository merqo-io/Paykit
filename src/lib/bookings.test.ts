import { describe, it, expect, vi, beforeEach } from "vitest";

const { maybeSingleMock, createServerClientMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  maybeSingleMock
    .mockReset()
    .mockResolvedValue({ data: { id: "b1" }, error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: maybeSingleMock }),
        }),
      }),
    }),
  });
});

describe("searchBookings", () => {
  function chain(...results: unknown[]) {
    const calls: Record<string, unknown[]> = {};
    const q: Record<string, unknown> = {};
    for (const name of ["select", "eq", "or", "order"]) {
      q[name] = (...args: unknown[]) => {
        calls[name] = [...(calls[name] ?? []), args];
        return q;
      };
    }
    let i = 0;
    q.range = (...args: unknown[]) => {
      calls.range = [...(calls.range ?? []), args];
      return Promise.resolve(results[Math.min(i++, results.length - 1)]);
    };
    createServerClientMock.mockResolvedValue({ from: () => q });
    return calls;
  }
  const base = { q: "", status: null, page: 1, pageSize: 20 } as const;

  it("filters by status and sanitized search, then pages", async () => {
    const calls = chain({ data: [{ id: "b1" }], count: 31, error: null });
    const { searchBookings } = await import("./bookings");
    const out = await searchBookings("v1", {
      q: "Ja,ne(%)",
      status: "cancelled",
      page: 2,
      pageSize: 20,
    });
    expect(out).toEqual({ ok: true, rows: [{ id: "b1" }], total: 31 });
    expect(calls.eq).toContainEqual(["status", "cancelled"]);
    expect(calls.or).toEqual([
      ["customer_name.ilike.%Ja ne%,customer_phone.ilike.%Ja ne%"],
    ]);
    expect(calls.range).toEqual([[20, 39]]);
  });

  it("skips the filters when none are set", async () => {
    const calls = chain({ data: null, count: null, error: null });
    const { searchBookings } = await import("./bookings");
    expect(await searchBookings("v1", base)).toEqual({
      ok: true,
      rows: [],
      total: 0,
    });
    expect(calls.or).toBeUndefined();
    expect(calls.range).toEqual([[0, 19]]);
  });

  it("treats a page past the end as empty and still returns the total", async () => {
    chain(
      { data: null, count: null, error: { code: "PGRST103", message: "416" } },
      { data: [{ id: "b1" }], count: 25, error: null },
    );
    const { searchBookings } = await import("./bookings");
    expect(await searchBookings("v1", { ...base, page: 9 })).toEqual({
      ok: true,
      rows: [],
      total: 25,
    });
  });

  it("fails when the total lookup after an out-of-range page fails", async () => {
    chain(
      { data: null, count: null, error: { code: "PGRST103", message: "416" } },
      { data: null, count: null, error: { message: "boom" } },
    );
    const { searchBookings } = await import("./bookings");
    expect(await searchBookings("v1", { ...base, page: 9 })).toEqual({
      ok: false,
    });
  });

  it("reports a database error instead of an empty list", async () => {
    chain({ data: null, count: null, error: { message: "boom" } });
    const { searchBookings } = await import("./bookings");
    expect(await searchBookings("v1", base)).toEqual({ ok: false });
  });
});

describe("getBooking", () => {
  it("returns the vendor's own booking by id", async () => {
    const { getBooking } = await import("./bookings");
    expect(await getBooking("v1", "b1")).toEqual({ id: "b1" });
  });

  it("returns null on a read error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { getBooking } = await import("./bookings");
    expect(await getBooking("v1", "b1")).toBeNull();
  });

  it("returns null when no matching booking exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { getBooking } = await import("./bookings");
    expect(await getBooking("v1", "missing")).toBeNull();
  });
});

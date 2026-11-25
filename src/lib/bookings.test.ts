import { describe, it, expect, vi, beforeEach } from "vitest";

const { orderMock, maybeSingleMock, createServerClientMock } = vi.hoisted(
  () => ({
    orderMock: vi.fn(),
    maybeSingleMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  orderMock
    .mockReset()
    .mockResolvedValue({ data: [{ id: "b1" }], error: null });
  maybeSingleMock
    .mockReset()
    .mockResolvedValue({ data: { id: "b1" }, error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: orderMock }),
          eq: () => ({ maybeSingle: maybeSingleMock }),
        }),
      }),
    }),
  });
});

describe("listBookings", () => {
  it("returns the vendor's bookings", async () => {
    const { listBookings } = await import("./bookings");
    expect(await listBookings("v1")).toEqual([{ id: "b1" }]);
  });

  it("returns an empty array on a read error", async () => {
    orderMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { listBookings } = await import("./bookings");
    expect(await listBookings("v1")).toEqual([]);
  });
});

describe("searchBookings", () => {
  function chain(result: unknown) {
    const calls: Record<string, unknown[]> = {};
    const q: Record<string, unknown> = {};
    for (const name of ["select", "eq", "or", "order"]) {
      q[name] = (...args: unknown[]) => {
        calls[name] = [...(calls[name] ?? []), args];
        return q;
      };
    }
    q.range = (...args: unknown[]) => {
      calls.range = [args];
      return Promise.resolve(result);
    };
    createServerClientMock.mockResolvedValue({ from: () => q });
    return calls;
  }

  it("filters by status and sanitized search, then pages", async () => {
    const calls = chain({ data: [{ id: "b1" }], count: 31, error: null });
    const { searchBookings } = await import("./bookings");
    const out = await searchBookings("v1", {
      q: "Ja,ne(%)",
      status: "cancelled",
      page: 2,
      pageSize: 20,
    });
    expect(out).toEqual({ rows: [{ id: "b1" }], total: 31 });
    expect(calls.eq).toContainEqual(["status", "cancelled"]);
    expect(calls.or).toEqual([
      ["customer_name.ilike.%Ja ne%,customer_phone.ilike.%Ja ne%"],
    ]);
    expect(calls.range).toEqual([[20, 39]]);
  });

  it("skips the filters when none are set", async () => {
    const calls = chain({ data: null, count: null, error: null });
    const { searchBookings } = await import("./bookings");
    expect(
      await searchBookings("v1", {
        q: "",
        status: null,
        page: 1,
        pageSize: 20,
      }),
    ).toEqual({ rows: [], total: 0 });
    expect(calls.or).toBeUndefined();
    expect(calls.range).toEqual([[0, 19]]);
  });

  it("returns nothing on a read error", async () => {
    chain({ data: null, count: null, error: { message: "boom" } });
    const { searchBookings } = await import("./bookings");
    expect(
      await searchBookings("v1", {
        q: "",
        status: null,
        page: 1,
        pageSize: 20,
      }),
    ).toEqual({ rows: [], total: 0 });
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

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import { linkInquiryToBooking } from "./inquiry-link";

type Result = { data: unknown; error: { message: string } | null };

function chain(result: Result) {
  const calls: unknown[][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "is", "select"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (resolve: (r: Result) => unknown) => resolve(result);
  return { q, calls };
}

function service(booking: Result, update: Result) {
  const b = chain(booking);
  const u = chain(update);
  const updateFn = vi.fn(() => u.q);
  createServiceClientMock.mockResolvedValue({
    from: (table: string) =>
      table === "bookings" ? { select: () => b.q } : { update: updateFn },
  });
  return { b, u, updateFn };
}

beforeEach(() => createServiceClientMock.mockReset());

describe("linkInquiryToBooking", () => {
  it("links an unlinked inquiry to the vendor's own booking", async () => {
    const { b, u, updateFn } = service(
      { data: { id: "b1" }, error: null },
      { data: [{ id: "i1" }], error: null },
    );
    expect(await linkInquiryToBooking("v1", "i1", "b1")).toBe(true);
    expect(b.calls).toEqual(
      expect.arrayContaining([
        ["eq", "id", "b1"],
        ["eq", "vendor_id", "v1"],
      ]),
    );
    expect(updateFn).toHaveBeenCalledWith({
      status: "converted",
      booking_id: "b1",
    });
    expect(u.calls).toEqual(
      expect.arrayContaining([
        ["eq", "id", "i1"],
        ["eq", "vendor_id", "v1"],
        ["is", "booking_id", null],
      ]),
    );
  });

  it("links nothing when the booking is not this vendor's", async () => {
    const { updateFn } = service(
      { data: null, error: null },
      { data: [], error: null },
    );
    expect(await linkInquiryToBooking("v1", "i1", "other")).toBe(false);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("returns false when no inquiry matched or the write failed", async () => {
    service({ data: { id: "b1" }, error: null }, { data: [], error: null });
    expect(await linkInquiryToBooking("v1", "i1", "b1")).toBe(false);
    service(
      { data: { id: "b1" }, error: null },
      { data: null, error: { message: "x" } },
    );
    expect(await linkInquiryToBooking("v1", "i1", "b1")).toBe(false);
  });
});

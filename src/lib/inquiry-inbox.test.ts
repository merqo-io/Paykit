import { describe, it, expect, vi, beforeEach } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

import {
  getInquiry,
  getInquiryForBooking,
  getInquiryForm,
  listOpenInquiries,
} from "./inquiry-inbox";

type Result = { data: unknown; error: { message: string } | null };

function client(result: Result) {
  const calls: unknown[][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  q.maybeSingle = () => Promise.resolve(result);
  q.then = (resolve: (r: Result) => unknown) => resolve(result);
  const from = vi.fn(() => q);
  createServerClientMock.mockResolvedValue({ from });
  return { calls, from };
}

const OK = { data: { id: "x" }, error: null };
const FAIL = { data: null, error: { message: "boom" } };

beforeEach(() => createServerClientMock.mockReset());

describe("inquiry inbox reads", () => {
  it("reads the vendor's form", async () => {
    const { calls, from } = client(OK);
    expect(await getInquiryForm("v1")).toEqual({ id: "x" });
    expect(from).toHaveBeenCalledWith("inquiry_forms");
    expect(calls).toContainEqual(["eq", "vendor_id", "v1"]);
  });

  it("lists open inquiries newest first, leaving converted ones out", async () => {
    const { calls } = client({ data: [{ id: "i1" }], error: null });
    expect(await listOpenInquiries("v1")).toEqual([{ id: "i1" }]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["eq", "vendor_id", "v1"],
        ["neq", "status", "converted"],
        ["order", "created_at", { ascending: false }],
      ]),
    );
  });

  it("reads one inquiry, and the one behind a booking, by vendor", async () => {
    let { calls } = client(OK);
    await getInquiry("v1", "i1");
    expect(calls).toEqual(
      expect.arrayContaining([
        ["eq", "vendor_id", "v1"],
        ["eq", "id", "i1"],
      ]),
    );
    ({ calls } = client(OK));
    await getInquiryForBooking("v1", "b1");
    expect(calls).toContainEqual(["eq", "booking_id", "b1"]);
  });

  it("falls back to empty on a read error", async () => {
    client(FAIL);
    expect(await getInquiryForm("v1")).toBeNull();
    expect(await listOpenInquiries("v1")).toEqual([]);
    expect(await getInquiry("v1", "i1")).toBeNull();
    expect(await getInquiryForBooking("v1", "b1")).toBeNull();
  });
});

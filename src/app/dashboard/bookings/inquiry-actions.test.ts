import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const { getVendorSessionMock } = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteInquiryAction,
  saveInquiryFormAction,
  setInquiryStatusAction,
} from "./inquiry-actions";

const INQUIRY_ID = "33333333-3333-3333-8333-333333333333";

type Result = { data?: unknown; error: { message: string } | null };

/** A query chain that records every filter and resolves to `result`. */
function chain(result: Result) {
  const calls: unknown[][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["eq", "neq", "select"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  q.then = (resolve: (r: Result) => unknown) => resolve(result);
  return { q, calls };
}

function vendorClient(tables: {
  update?: Result;
  insert?: Result;
  delete?: Result;
}) {
  const update = chain(tables.update ?? { data: [], error: null });
  const del = chain(tables.delete ?? { data: [], error: null });
  const insert = vi.fn().mockResolvedValue(tables.insert ?? { error: null });
  const updateFn = vi.fn(() => update.q);
  const client = {
    from: vi.fn(() => ({
      update: updateFn,
      insert,
      delete: () => del.q,
    })),
  };
  return { client, update, updateFn, del, insert };
}

function settings(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields = {
    business_name: "Kopi Cart Co",
    enabled: "on",
    terms_url: "",
    terms_version: "",
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function useClient(client: unknown) {
  getVendorSessionMock.mockResolvedValue({
    supabase: client,
    user: { id: "v1" },
  });
}

beforeEach(() => {
  vi.mocked(revalidatePath).mockReset();
});

describe("saveInquiryFormAction", () => {
  it("updates the vendor's existing form", async () => {
    const { client, updateFn, update, insert } = vendorClient({
      update: { data: [{ vendor_id: "v1" }], error: null },
    });
    useClient(client);
    const result = await saveInquiryFormAction(
      { status: "idle" },
      settings({ terms_url: "https://example.com/t", terms_version: "v1" }),
    );
    expect(result).toEqual({ status: "ok" });
    expect(updateFn).toHaveBeenCalledWith({
      business_name: "Kopi Cart Co",
      enabled: true,
      terms_url: "https://example.com/t",
      terms_version: "v1",
    });
    expect(update.calls).toContainEqual(["eq", "vendor_id", "v1"]);
    expect(insert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("creates the form when none exists, with empty terms as null", async () => {
    const { client, insert } = vendorClient({});
    useClient(client);
    const fd = settings();
    fd.delete("enabled");
    expect(await saveInquiryFormAction({ status: "idle" }, fd)).toEqual({
      status: "ok",
    });
    expect(insert).toHaveBeenCalledWith({
      vendor_id: "v1",
      business_name: "Kopi Cart Co",
      enabled: false,
      terms_url: null,
      terms_version: null,
    });
  });

  it("returns the validation message and writes nothing", async () => {
    const { client, updateFn } = vendorClient({});
    useClient(client);
    expect(
      await saveInquiryFormAction(
        { status: "idle" },
        settings({ terms_url: "http://example.com", terms_version: "v1" }),
      ),
    ).toEqual({ status: "error", message: "Use an https:// link" });
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("reports a failed write", async () => {
    const { client } = vendorClient({ insert: { error: { message: "x" } } });
    useClient(client);
    expect(
      (await saveInquiryFormAction({ status: "idle" }, settings())).status,
    ).toBe("error");
  });
});

describe("setInquiryStatusAction", () => {
  it("updates only an open inquiry of this vendor", async () => {
    const { client, updateFn, update } = vendorClient({
      update: { data: [{ id: INQUIRY_ID }], error: null },
    });
    useClient(client);
    expect(await setInquiryStatusAction(INQUIRY_ID, "contacted")).toEqual({
      status: "ok",
    });
    expect(updateFn).toHaveBeenCalledWith({ status: "contacted" });
    expect(update.calls).toEqual(
      expect.arrayContaining([
        ["eq", "id", INQUIRY_ID],
        ["eq", "vendor_id", "v1"],
        ["neq", "status", "converted"],
      ]),
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/bookings/inquiries/${INQUIRY_ID}`,
    );
  });

  it("refuses converted as a status and a bad id", async () => {
    const { client, updateFn } = vendorClient({});
    useClient(client);
    expect((await setInquiryStatusAction(INQUIRY_ID, "converted")).status).toBe(
      "error",
    );
    expect((await setInquiryStatusAction("x", "declined")).status).toBe(
      "error",
    );
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("reports no matching row as an error", async () => {
    const { client } = vendorClient({ update: { data: [], error: null } });
    useClient(client);
    expect((await setInquiryStatusAction(INQUIRY_ID, "declined")).status).toBe(
      "error",
    );
  });
});

describe("deleteInquiryAction", () => {
  it("deletes this vendor's inquiry", async () => {
    const { client, del } = vendorClient({
      delete: { data: [{ id: INQUIRY_ID }], error: null },
    });
    useClient(client);
    expect(await deleteInquiryAction(INQUIRY_ID)).toEqual({ status: "ok" });
    expect(del.calls).toEqual(
      expect.arrayContaining([
        ["eq", "id", INQUIRY_ID],
        ["eq", "vendor_id", "v1"],
      ]),
    );
  });

  it("refuses a bad id and reports a missing row", async () => {
    const { client } = vendorClient({});
    useClient(client);
    expect((await deleteInquiryAction("x")).status).toBe("error");
    expect((await deleteInquiryAction(INQUIRY_ID)).status).toBe("error");
  });
});

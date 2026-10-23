import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/inquiry-alert", () => ({ sendInquiryAlert: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

const { sendInquiryAlert } = await import("@/lib/inquiry-alert");
const { rateLimit } = await import("@/lib/rate-limit");
import {
  INQUIRY_LIMITS,
  inquiryAllowed,
  loadPublicForm,
  submitInquiry,
  type PublicInquiryForm,
} from "./inquiries";

const VENDOR = "00000000-0000-4000-8000-00000000000a";
const PUBLIC_ID = "0123456789abcdef";

const form: PublicInquiryForm = {
  vendor_id: VENDOR,
  business_name: "Kopi Cart Co",
  terms_url: null,
  terms_version: null,
};
const withTerms: PublicInquiryForm = {
  ...form,
  terms_url: "https://example.com/terms.pdf",
  terms_version: "v2",
};
const input = {
  customer_name: "Jane Tan",
  customer_phone: "+65 9123 4567",
  event_date: "2026-12-12",
  message: "Wedding, 120 guests",
  terms_accepted: false,
};

function insertClient(error: { message: string } | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

beforeEach(() => {
  vi.mocked(sendInquiryAlert).mockReset();
  vi.mocked(rateLimit).mockReset();
});

describe("loadPublicForm", () => {
  it("does not query for a malformed public id", async () => {
    const from = vi.fn();
    expect(await loadPublicForm({ from } as never, "../etc")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("reads only an enabled form by its public id", async () => {
    const eq = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({ data: form, error: null });
    const chain = { eq, maybeSingle };
    eq.mockReturnValue(chain);
    const client = { from: () => ({ select: () => chain }) };
    expect(await loadPublicForm(client as never, PUBLIC_ID)).toEqual(form);
    expect(eq).toHaveBeenCalledWith("public_id", PUBLIC_ID);
    expect(eq).toHaveBeenCalledWith("enabled", true);
  });

  it("returns null on a read error", async () => {
    const chain = {
      eq: () => chain,
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "x" } }),
    };
    const client = { from: () => ({ select: () => chain }) };
    expect(await loadPublicForm(client as never, PUBLIC_ID)).toBeNull();
  });
});

describe("inquiryAllowed", () => {
  it("stops at the address limit without counting the form", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce(false);
    expect(await inquiryAllowed({} as never, "203.0.113.7", PUBLIC_ID)).toBe(
      false,
    );
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(rateLimit).toHaveBeenCalledWith(
      {},
      "inquiry:ip:203.0.113.7",
      INQUIRY_LIMITS.perIp.limit,
      INQUIRY_LIMITS.perIp.windowSeconds,
    );
  });

  it("then counts the form", async () => {
    vi.mocked(rateLimit)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    expect(await inquiryAllowed({} as never, "203.0.113.7", PUBLIC_ID)).toBe(
      false,
    );
    expect(rateLimit).toHaveBeenLastCalledWith(
      {},
      `inquiry:form:${PUBLIC_ID}`,
      30,
      3600,
    );
  });
});

describe("submitInquiry", () => {
  const now = new Date("2026-10-24T06:05:00Z");

  it("stores an inquiry with no terms snapshot and alerts the vendor", async () => {
    const { client, insert } = insertClient();
    expect(await submitInquiry(client as never, form, input, now)).toEqual({
      ok: true,
    });
    expect(insert).toHaveBeenCalledWith({
      vendor_id: VENDOR,
      customer_name: "Jane Tan",
      customer_phone: "+65 9123 4567",
      event_date: "2026-12-12",
      message: "Wedding, 120 guests",
      terms_url: null,
      terms_version: null,
      terms_accepted_at: null,
    });
    expect(sendInquiryAlert).toHaveBeenCalledWith(
      VENDOR,
      "Jane Tan",
      "2026-12-12",
    );
  });

  it("stores an empty event date as null", async () => {
    const { client, insert } = insertClient();
    await submitInquiry(client as never, form, { ...input, event_date: "" });
    expect(insert.mock.calls[0][0].event_date).toBeNull();
  });

  it("refuses when the vendor has terms and the box is not ticked", async () => {
    const { client, insert } = insertClient();
    expect(await submitInquiry(client as never, withTerms, input, now)).toEqual(
      {
        ok: false,
        reason: "terms_required",
      },
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("snapshots the server-read terms with the acceptance time", async () => {
    const { client, insert } = insertClient();
    await submitInquiry(
      client as never,
      withTerms,
      { ...input, terms_accepted: true },
      now,
    );
    expect(insert.mock.calls[0][0]).toMatchObject({
      terms_url: "https://example.com/terms.pdf",
      terms_version: "v2",
      terms_accepted_at: "2026-10-24T06:05:00.000Z",
    });
  });

  it("ignores a ticked box when the vendor has no terms", async () => {
    const { client, insert } = insertClient();
    await submitInquiry(
      client as never,
      form,
      { ...input, terms_accepted: true },
      now,
    );
    expect(insert.mock.calls[0][0].terms_accepted_at).toBeNull();
  });

  it("reports a failed write and sends no alert", async () => {
    const { client } = insertClient({ message: "boom" });
    expect(await submitInquiry(client as never, form, input, now)).toEqual({
      ok: false,
      reason: "write_failed",
    });
    expect(sendInquiryAlert).not.toHaveBeenCalled();
  });
});

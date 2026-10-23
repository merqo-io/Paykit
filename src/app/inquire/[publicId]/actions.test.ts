import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadMock, allowedMock, submitMock, createServiceClientMock } =
  vi.hoisted(() => ({
    loadMock: vi.fn(),
    allowedMock: vi.fn(),
    submitMock: vi.fn(),
    createServiceClientMock: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  loadPublicForm: loadMock,
  inquiryAllowed: allowedMock,
  submitInquiry: submitMock,
}));

import { submitInquiryAction } from "./actions";

const PUBLIC_ID = "0123456789abcdef";
const SUPABASE = { marker: "service-client" };
const FORM = {
  vendor_id: "11111111-1111-1111-1111-111111111111",
  business_name: "Kopi Cart Co",
  terms_url: null,
  terms_version: null,
};
const IDLE = { status: "idle" } as const;

function fd(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    customer_name: "Jane Tan",
    customer_phone: "+65 9123 4567",
    event_date: "2026-12-12",
    message: "Wedding, 120 guests",
    started_at: String(Date.now() - 10_000),
    website: "",
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  createServiceClientMock.mockResolvedValue(SUPABASE);
  allowedMock.mockResolvedValue(true);
  loadMock.mockResolvedValue(FORM);
  submitMock.mockResolvedValue({ ok: true });
});

describe("submitInquiryAction", () => {
  it("stores a valid inquiry against the server-read form", async () => {
    expect(await submitInquiryAction(PUBLIC_ID, IDLE, fd())).toEqual({
      status: "sent",
    });
    expect(allowedMock).toHaveBeenCalledWith(
      SUPABASE,
      "203.0.113.5",
      PUBLIC_ID,
    );
    expect(loadMock).toHaveBeenCalledWith(SUPABASE, PUBLIC_ID);
    expect(submitMock).toHaveBeenCalledWith(SUPABASE, FORM, {
      customer_name: "Jane Tan",
      customer_phone: "+65 9123 4567",
      event_date: "2026-12-12",
      message: "Wedding, 120 guests",
      terms_accepted: false,
    });
  });

  it("passes a ticked terms box through", async () => {
    await submitInquiryAction(PUBLIC_ID, IDLE, fd({ terms_accepted: "on" }));
    expect(submitMock.mock.calls[0][2].terms_accepted).toBe(true);
  });

  it("answers sent and stores nothing when the honeypot is filled", async () => {
    expect(
      await submitInquiryAction(PUBLIC_ID, IDLE, fd({ website: "spam.biz" })),
    ).toEqual({ status: "sent" });
    expect(createServiceClientMock).not.toHaveBeenCalled();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("answers sent and stores nothing for a submit under 3 seconds", async () => {
    for (const started_at of [String(Date.now() - 500), "", "soon"]) {
      expect(
        await submitInquiryAction(PUBLIC_ID, IDLE, fd({ started_at })),
      ).toEqual({ status: "sent" });
    }
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed public id before any read", async () => {
    const result = await submitInquiryAction("nope", IDLE, fd());
    expect(result.status).toBe("error");
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("returns the first validation message", async () => {
    expect(
      await submitInquiryAction(PUBLIC_ID, IDLE, fd({ customer_phone: "x" })),
    ).toEqual({ status: "error", message: "Enter a valid phone number" });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("refuses when rate limited, before reading the form", async () => {
    allowedMock.mockResolvedValue(false);
    expect(await submitInquiryAction(PUBLIC_ID, IDLE, fd())).toEqual({
      status: "error",
      message: "Too many inquiries. Try again later.",
    });
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("refuses when the form is gone or turned off", async () => {
    loadMock.mockResolvedValue(null);
    expect(await submitInquiryAction(PUBLIC_ID, IDLE, fd())).toEqual({
      status: "error",
      message: "This inquiry form is no longer available.",
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("asks for the terms box when the vendor requires it", async () => {
    submitMock.mockResolvedValue({ ok: false, reason: "terms_required" });
    expect(await submitInquiryAction(PUBLIC_ID, IDLE, fd())).toEqual({
      status: "error",
      message: "Tick the box to accept the booking terms.",
    });
  });

  it("asks to retry when the write fails", async () => {
    submitMock.mockResolvedValue({ ok: false, reason: "write_failed" });
    expect(await submitInquiryAction(PUBLIC_ID, IDLE, fd())).toEqual({
      status: "error",
      message: "Could not send your inquiry. Try again.",
    });
  });
});

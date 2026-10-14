import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadMock, allowedMock, claimMock, createServiceClientMock } =
  vi.hoisted(() => ({
    loadMock: vi.fn(),
    allowedMock: vi.fn(),
    claimMock: vi.fn(),
    createServiceClientMock: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/hosted-pay", () => ({
  loadHostedPayment: loadMock,
  hostedPayAllowed: allowedMock,
}));
vi.mock("@/lib/claim", () => ({ claimTransaction: claimMock }));

import { claimHostedPayment, getHostedPaymentStatus } from "./actions";
import { PROOF_MAX_BYTES } from "@/lib/proof-file";

const TX_ID = "22222222-2222-2222-2222-222222222222";
const TOKEN = "a".repeat(43);
const RETURN_URL = "https://qkit.merqo.io/order/b1/pay?t=abc";
const SUPABASE = { marker: "service-client" };

const ROW = {
  id: TX_ID,
  vendor_id: "11111111-1111-1111-1111-111111111111",
  kit_slug: "qkit",
  order_ref: "order-ref-secret",
  amount_cents: 450,
  status: "pending",
};
const PAYMENT = {
  id: TX_ID,
  status: "pending",
  amountCents: 450,
  title: "Order from Kopitiam Cart",
  returnUrl: RETURN_URL,
  view: { type: "qr", payload: "PAYLOAD" },
};

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const GIF = [..."GIF89a"].map((c) => c.charCodeAt(0));

function form(...files: (File | string)[]) {
  const body = new FormData();
  for (const file of files) body.append("proof", file);
  return body;
}

function image(bytes: number[] = JPEG, type = "image/jpeg") {
  return new File([new Uint8Array(bytes)], "shot.jpg", { type });
}

beforeEach(() => {
  createServiceClientMock.mockReset().mockResolvedValue(SUPABASE);
  allowedMock.mockReset().mockResolvedValue(true);
  loadMock
    .mockReset()
    .mockResolvedValue({ ok: true, row: ROW, payment: PAYMENT });
  claimMock.mockReset().mockResolvedValue({
    ok: true,
    row: { ...ROW, status: "claimed" },
  });
});

describe("claimHostedPayment", () => {
  it("claims with the screenshot and answers the return address", async () => {
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({ success: true, returnUrl: RETURN_URL });
    expect(allowedMock).toHaveBeenCalledWith(
      SUPABASE,
      "claim",
      "203.0.113.5",
      TOKEN,
    );
    expect(loadMock).toHaveBeenCalledWith(SUPABASE, TX_ID, TOKEN);
    const [client, row, proof, audit] = claimMock.mock.calls[0]!;
    expect(client).toBe(SUPABASE);
    expect(row).toBe(ROW);
    expect(proof.contentType).toBe("image/jpeg");
    expect(audit).toEqual({ kitSlug: "qkit", detail: { via: "pay_page" } });
  });

  it("answers nothing about the transaction beyond the return address", async () => {
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(Object.keys(res).sort()).toEqual(["returnUrl", "success"]);
    expect(JSON.stringify(res)).not.toContain("order-ref-secret");
    expect(JSON.stringify(res)).not.toContain(ROW.vendor_id);
  });

  it("is idempotent: a payment already claimed answers success again", async () => {
    loadMock.mockResolvedValue({
      ok: true,
      row: { ...ROW, status: "claimed" },
      payment: { ...PAYMENT, status: "claimed" },
    });
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({ success: true, returnUrl: RETURN_URL });
  });

  it.each([
    ["an id that is not text", 5, TOKEN],
    ["a token that is not text", TX_ID, null],
    ["a token that is an object", TX_ID, { k: TOKEN }],
  ])("refuses %s without touching the database", async (_n, id, token) => {
    const res = await claimHostedPayment(id, token, form(image()));
    expect(res).toEqual({
      success: false,
      error: "This payment link is no longer valid.",
    });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a form", async () => {
    const res = await claimHostedPayment(TX_ID, TOKEN, { proof: image() });
    expect(res).toEqual({
      success: false,
      error: "A payment screenshot is required.",
    });
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("refuses a rate-limited call before reading the transaction", async () => {
    allowedMock.mockResolvedValue(false);
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({
      success: false,
      error: "Too many attempts. Wait a moment.",
    });
    expect(loadMock).not.toHaveBeenCalled();
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("gives a wrong token the same answer as an unknown id", async () => {
    loadMock.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({
      success: false,
      error: "This payment link is no longer valid.",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("asks for a retry when the transaction cannot be read", async () => {
    loadMock.mockResolvedValue({ ok: false, reason: "unavailable" });
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({
      success: false,
      error: "Could not record payment. Try again.",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no file", form()],
    ["two files", form(image(), image())],
    ["text in place of a file", form("not a file")],
  ])("requires exactly one screenshot: %s", async (_name, body) => {
    const res = await claimHostedPayment(TX_ID, TOKEN, body);
    expect(res).toEqual({
      success: false,
      error: "A payment screenshot is required.",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it.each([
    ["bytes that are not an image", image(GIF, "image/png")],
    ["an empty file", image([], "image/png")],
  ])("refuses %s and claims nothing", async (_name, file) => {
    const res = await claimHostedPayment(TX_ID, TOKEN, form(file));
    expect(res).toEqual({
      success: false,
      error: "Upload a screenshot or photo (JPEG, PNG or WebP).",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("refuses a file over 1 MB and claims nothing", async () => {
    const big = new Uint8Array(PROOF_MAX_BYTES + 1);
    big.set(JPEG);
    const res = await claimHostedPayment(
      TX_ID,
      TOKEN,
      form(new File([big], "big.jpg", { type: "image/jpeg" })),
    );
    expect(res).toEqual({
      success: false,
      error: "That image is too large. Try a screenshot instead of a photo.",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the screenshot cannot be stored",
      { ok: false, status: 503, error: "Could not store the payment proof" },
    ],
    [
      "the claim did not land",
      { ok: true, row: { ...ROW, status: "pending" } },
    ],
  ])("asks for a retry when %s", async (_name, outcome) => {
    claimMock.mockResolvedValue(outcome);
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({
      success: false,
      error: "Could not record payment. Try again.",
    });
  });

  it("answers a null return address when the transaction has none", async () => {
    loadMock.mockResolvedValue({
      ok: true,
      row: ROW,
      payment: { ...PAYMENT, returnUrl: null },
    });
    const res = await claimHostedPayment(TX_ID, TOKEN, form(image()));
    expect(res).toEqual({ success: true, returnUrl: null });
  });
});

describe("getHostedPaymentStatus", () => {
  it("answers the status and return address only", async () => {
    const res = await getHostedPaymentStatus(TX_ID, TOKEN);
    expect(res).toEqual({ status: "pending", returnUrl: RETURN_URL });
    expect(allowedMock).toHaveBeenCalledWith(
      SUPABASE,
      "status",
      "203.0.113.5",
      TOKEN,
    );
  });

  it("reports a claimed payment", async () => {
    loadMock.mockResolvedValue({
      ok: true,
      row: ROW,
      payment: { ...PAYMENT, status: "claimed" },
    });
    expect(await getHostedPaymentStatus(TX_ID, TOKEN)).toEqual({
      status: "claimed",
      returnUrl: RETURN_URL,
    });
  });

  it.each([
    ["an id that is not text", undefined, TOKEN],
    ["a token that is not text", TX_ID, 7],
  ])("answers null for %s without touching the database", async (_n, a, b) => {
    expect(await getHostedPaymentStatus(a, b)).toBeNull();
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("answers null when rate limited, without reading", async () => {
    allowedMock.mockResolvedValue(false);
    expect(await getHostedPaymentStatus(TX_ID, TOKEN)).toBeNull();
    expect(loadMock).not.toHaveBeenCalled();
  });

  it.each([["not_found"], ["unavailable"]])(
    "answers null when the read is %s",
    async (reason) => {
      loadMock.mockResolvedValue({ ok: false, reason });
      expect(await getHostedPaymentStatus(TX_ID, TOKEN)).toBeNull();
    },
  );
});

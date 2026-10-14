import { describe, it, expect, vi, beforeEach } from "vitest";
import { hostedPayAllowed, loadHostedPayment } from "@/lib/hosted-pay";
import { mintPayToken, payTokenKey } from "@/lib/pay-token";

const TX_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ID = "33333333-3333-3333-3333-333333333333";
const VENDOR_ID = "11111111-1111-1111-1111-111111111111";

const { token, hash } = mintPayToken();

const ROW = {
  id: TX_ID,
  vendor_id: VENDOR_ID,
  kit_slug: "qkit",
  order_ref: "order-ref-secret",
  amount_cents: 450,
  status: "pending",
  qr_payload: "00020101PAYLOAD",
  checkout_kind: "qr",
  checkout_label: null,
  pay_token_hash: hash,
  return_url: "https://qkit.merqo.io/order/b1/pay?t=abc",
  pay_title: "Order from Kopitiam Cart",
  claimed_at: null,
  confirmed_at: null,
  created_at: "2026-10-13T00:00:00Z",
};

const maybeSingle = vi.fn();
const eq = vi.fn((_column: string, _value: string) => ({ maybeSingle }));
const from = vi.fn((_table: string) => ({ select: () => ({ eq }) }));

type Client = Parameters<typeof loadHostedPayment>[0];
const supabase = { from } as unknown as Client;

beforeEach(() => {
  from.mockClear();
  eq.mockClear();
  maybeSingle.mockReset().mockResolvedValue({ data: ROW, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadHostedPayment", () => {
  it("returns the payment for the holder of its token", async () => {
    const read = await loadHostedPayment(supabase, TX_ID, token);
    expect(read).toEqual({
      ok: true,
      row: ROW,
      payment: {
        id: TX_ID,
        status: "pending",
        amountCents: 450,
        title: "Order from Kopitiam Cart",
        returnUrl: "https://qkit.merqo.io/order/b1/pay?t=abc",
        view: { type: "qr", payload: "00020101PAYLOAD" },
      },
    });
    expect(eq).toHaveBeenCalledWith("id", TX_ID);
  });

  it("puts nothing about the vendor, the order or the kit in the payment", async () => {
    const read = await loadHostedPayment(supabase, TX_ID, token);
    if (!read.ok) throw new Error("expected a payment");
    const sent = JSON.stringify(read.payment);
    expect(sent).not.toContain(VENDOR_ID);
    expect(sent).not.toContain("order-ref-secret");
    expect(sent).not.toContain('qkit"');
    expect(sent).not.toContain(hash);
    expect(Object.keys(read.payment).sort()).toEqual(
      ["amountCents", "id", "returnUrl", "status", "title", "view"].sort(),
    );
  });

  it.each([
    [
      "a link",
      {
        checkout_kind: "link",
        qr_payload: "https://pay.example/x",
        checkout_label: "Pay with PayLah",
      },
      { type: "link", url: "https://pay.example/x", label: "Pay with PayLah" },
    ],
    [
      "an image",
      { checkout_kind: "image", qr_payload: "https://img.example/qr.png" },
      { type: "image", url: "https://img.example/qr.png" },
    ],
  ])("maps %s view from the stored snapshot", async (_n, patch, view) => {
    maybeSingle.mockResolvedValue({ data: { ...ROW, ...patch }, error: null });
    const read = await loadHostedPayment(supabase, TX_ID, token);
    expect(read).toMatchObject({ ok: true, payment: { view } });
  });

  it("reads a missing title and return address as null", async () => {
    maybeSingle.mockResolvedValue({
      data: { ...ROW, pay_title: null, return_url: undefined },
      error: null,
    });
    const read = await loadHostedPayment(supabase, TX_ID, token);
    expect(read).toMatchObject({
      ok: true,
      payment: { title: null, returnUrl: null },
    });
  });

  it.each([
    ["an id that is not a uuid", "not-a-uuid", token],
    ["an empty id", "", token],
    ["an empty token", TX_ID, ""],
    ["a short token", TX_ID, token.slice(0, 42)],
    ["a long token", TX_ID, `${token}A`],
    [
      "a token with a character outside the alphabet",
      TX_ID,
      `${token.slice(0, 42)}=`,
    ],
  ])("answers not_found for %s without reading anything", async (_n, id, k) => {
    expect(await loadHostedPayment(supabase, id, k)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("answers not_found for an id that does not exist", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await loadHostedPayment(supabase, OTHER_ID, token)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("answers not_found for a transaction that has no pay page", async () => {
    maybeSingle.mockResolvedValue({
      data: { ...ROW, pay_token_hash: null },
      error: null,
    });
    expect(await loadHostedPayment(supabase, TX_ID, token)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("answers not_found for another transaction's token", async () => {
    const other = mintPayToken().token;
    expect(await loadHostedPayment(supabase, TX_ID, other)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("answers not_found for a token that is wrong in its last character", async () => {
    const last = token.endsWith("A") ? "B" : "A";
    const near = token.slice(0, -1) + last;
    expect(await loadHostedPayment(supabase, TX_ID, near)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("does not accept the stored hash in place of the token", async () => {
    expect(await loadHostedPayment(supabase, TX_ID, hash)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("answers unavailable, with no payment, when the read fails", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    expect(await loadHostedPayment(supabase, TX_ID, token)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("hostedPayAllowed", () => {
  const rpc = vi.fn();
  const limiter = { rpc } as unknown as Client;
  const IP = "203.0.113.5";

  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it("counts the address first and then the token, by a prefix of its hash", async () => {
    expect(await hostedPayAllowed(limiter, "claim", IP, token)).toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(1, "check_rate_limit", {
      p_key: `pay-claim:ip:${IP}`,
      p_limit: 60,
      p_window_seconds: 60,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "check_rate_limit", {
      p_key: `pay-claim:tok:${payTokenKey(token)}`,
      p_limit: 10,
      p_window_seconds: 60,
    });
  });

  it("never puts the token itself in a limiter key", async () => {
    await hostedPayAllowed(limiter, "view", IP, token);
    await hostedPayAllowed(limiter, "status", IP, token);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(token);
  });

  it("refuses on the address without counting the token", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await hostedPayAllowed(limiter, "status", IP, token)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses when the token has been used too often", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    expect(await hostedPayAllowed(limiter, "view", IP, token)).toBe(false);
  });

  it("counts only the address for a malformed token", async () => {
    expect(await hostedPayAllowed(limiter, "view", IP, "x".repeat(5000))).toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the three actions in separate counters", async () => {
    await hostedPayAllowed(limiter, "view", IP, token);
    await hostedPayAllowed(limiter, "status", IP, token);
    await hostedPayAllowed(limiter, "claim", IP, token);
    const keys = rpc.mock.calls.map((call) => call[1].p_key);
    expect(new Set(keys).size).toBe(6);
  });
});

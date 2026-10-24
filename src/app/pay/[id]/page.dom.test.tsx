// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { loadMock, allowedMock, notFoundMock, redirectMock } = vi.hoisted(
  () => ({
    loadMock: vi.fn(),
    allowedMock: vi.fn(),
    notFoundMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({}),
}));
vi.mock("@/lib/hosted-pay", () => ({
  loadHostedPayment: loadMock,
  hostedPayAllowed: allowedMock,
}));
vi.mock("./pay-panel", () => ({
  PayPanel: (props: Record<string, unknown>) => (
    <div data-testid="pay-panel">{JSON.stringify(props)}</div>
  ),
}));

import PayPage, { metadata } from "./page";

const TX_ID = "22222222-2222-2222-8222-222222222222";
const TOKEN = "a".repeat(43);
const RETURN_URL = "https://qkit.merqo.io/order/b1/pay?t=abc";

const PAYMENT = {
  id: TX_ID,
  status: "pending",
  amountCents: 450,
  title: "Order from Kopitiam Cart",
  returnUrl: RETURN_URL,
  view: { type: "qr", payload: "PAYLOAD" },
};
const ROW = {
  id: TX_ID,
  vendor_id: "11111111-1111-1111-8111-111111111111",
  order_ref: "order-ref-secret",
  kit_slug: "qkit",
  pay_token_hash: "f".repeat(64),
};

class Stop extends Error {}

// Called with no argument it carries the right token; an explicit
// `undefined` is a link with no token at all.
function page(...given: [k?: string | string[]]) {
  const k = given.length > 0 ? given[0] : TOKEN;
  return PayPage({
    params: Promise.resolve({ id: TX_ID }),
    searchParams: Promise.resolve({ k }),
  });
}

beforeEach(() => {
  allowedMock.mockReset().mockResolvedValue(true);
  loadMock
    .mockReset()
    .mockResolvedValue({ ok: true, row: ROW, payment: PAYMENT });
  notFoundMock.mockReset().mockImplementation(() => {
    throw new Stop("not found");
  });
  redirectMock.mockReset().mockImplementation(() => {
    throw new Stop("redirect");
  });
});

describe("PayPage", () => {
  it("asks search engines and referrers to stay out", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("renders the panel for a pending payment with plain data only", async () => {
    render(await page());
    const props = JSON.parse(screen.getByTestId("pay-panel").textContent!);
    expect(props).toEqual({
      id: TX_ID,
      token: TOKEN,
      title: "Order from Kopitiam Cart",
      amountCents: 450,
      view: { type: "qr", payload: "PAYLOAD" },
    });
  });

  it("sends nothing about the vendor, the order or the kit to the browser", async () => {
    const { container } = render(await page());
    expect(container.innerHTML).not.toContain(ROW.vendor_id);
    expect(container.innerHTML).not.toContain("order-ref-secret");
    expect(container.innerHTML).not.toContain(ROW.pay_token_hash);
  });

  it.each([
    ["no token", undefined],
    ["a token given twice", [TOKEN, TOKEN]],
  ])("is a 404 with %s, before anything is read", async (_name, k) => {
    await expect(page(k)).rejects.toThrow("not found");
    expect(allowedMock).not.toHaveBeenCalled();
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("is a 404 when the token is not this payment's", async () => {
    loadMock.mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(page()).rejects.toThrow("not found");
  });

  it("counts the view against the address and the token", async () => {
    await page();
    expect(allowedMock).toHaveBeenCalledWith(
      expect.anything(),
      "view",
      "203.0.113.5",
      TOKEN,
    );
  });

  it("shows a wait notice, and reads nothing, when rate limited", async () => {
    allowedMock.mockResolvedValue(false);
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Too many tries" }),
    ).toBeInTheDocument();
    expect(loadMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pay-panel")).not.toBeInTheDocument();
  });

  it("shows a retry notice and no payment when the read fails", async () => {
    loadMock.mockResolvedValue({ ok: false, reason: "unavailable" });
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Couldn't load payment right now" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pay-panel")).not.toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it.each([["claimed"], ["confirmed"]])(
    "sends a %s payment straight to its return address",
    async (status) => {
      loadMock.mockResolvedValue({
        ok: true,
        row: ROW,
        payment: { ...PAYMENT, status },
      });
      await expect(page()).rejects.toThrow("redirect");
      expect(redirectMock).toHaveBeenCalledWith(RETURN_URL);
    },
  );

  it("says the payment is recorded when there is nowhere to return to", async () => {
    loadMock.mockResolvedValue({
      ok: true,
      row: ROW,
      payment: { ...PAYMENT, status: "claimed", returnUrl: null },
    });
    render(await page());
    expect(
      screen.getByRole("heading", { name: "Payment recorded" }),
    ).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

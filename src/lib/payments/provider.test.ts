import { describe, it, expect, vi, afterEach } from "vitest";
import { getProvider, directProvider } from "./provider";
import type { VendorPaymentConfig } from "@/lib/types";

describe("getProvider", () => {
  const original = process.env.PAYKIT_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.PAYKIT_PROVIDER;
    else process.env.PAYKIT_PROVIDER = original;
  });

  it("defaults to the direct provider when unset", () => {
    delete process.env.PAYKIT_PROVIDER;
    expect(getProvider()).toBe(directProvider);
  });

  it("selects the direct provider explicitly", () => {
    process.env.PAYKIT_PROVIDER = "direct";
    expect(getProvider()).toBe(directProvider);
  });

  it("falls back to direct and warns on an unrecognized value", () => {
    process.env.PAYKIT_PROVIDER = "not-a-real-provider";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getProvider()).toBe(directProvider);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("not-a-real-provider"),
    );
    warn.mockRestore();
  });

  it('falls back to direct and warns on a prototype-chain key like "constructor"', () => {
    process.env.PAYKIT_PROVIDER = "constructor";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getProvider()).toBe(directProvider);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("constructor"));
    warn.mockRestore();
  });
});

describe("directProvider", () => {
  const paynowConfig: VendorPaymentConfig = {
    vendor_id: "11111111-1111-1111-8111-111111111111",
    kind: "paynow",
    uen: "53312345A",
    mobile: null,
    payee_name: "Kopitiam Cart",
    label: null,
    url: null,
    qr_image_url: null,
    verification_method: "manual",
    plan: "free",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("delegates createCheckout to renderCheckout (same behavior as before this seam)", async () => {
    const view = await directProvider.createCheckout(paynowConfig, {
      amountCents: 450,
      orderRef: "order-1",
    });
    expect(view?.type).toBe("qr");
    expect((view as { payload: string }).payload).toContain("SG.PAYNOW");
  });

  it("getStatus always resolves null — no external state to reconcile", async () => {
    await expect(directProvider.getStatus("tx1")).resolves.toBeNull();
  });
});

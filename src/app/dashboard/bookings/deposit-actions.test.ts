import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
const {
  session,
  service,
  bookingRead,
  lookup,
  link,
  checkout,
  transactionFilter,
} = vi.hoisted(() => ({
  session: vi.fn(),
  service: vi.fn(),
  bookingRead: vi.fn(),
  lookup: vi.fn(),
  link: vi.fn(),
  checkout: vi.fn(),
  transactionFilter: vi.fn(),
}));
vi.mock("@/lib/vendor-session", () => ({ getVendorSession: session }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: service }));
vi.mock("@/lib/checkout", () => ({ createCheckout: checkout }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { recoverDepositCheckoutAction } from "./deposit-actions";
const bookingId = "11111111-1111-1111-8111-111111111111";
const vendorId = "22222222-2222-2222-8222-222222222222";
const txId = "33333333-3333-3333-8333-333333333333";
const booking = {
  id: bookingId,
  status: "pending_deposit",
  deposit_amount_cents: 30000,
  deposit_transaction_id: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  bookingRead.mockReset().mockResolvedValue({ data: booking, error: null });
  lookup.mockReset().mockResolvedValue({
    data: { id: txId, amount_cents: 30000 },
    error: null,
  });
  link.mockReset().mockResolvedValue({ data: bookingId, error: null });
  checkout.mockReset().mockResolvedValue({
    ok: true,
    type: "qr",
    transaction_id: txId,
    payload: "qr",
  });
  session.mockReset().mockResolvedValue({
    user: { id: vendorId },
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: bookingRead }) }),
      }),
    },
  });
  const query = { eq: transactionFilter.mockReturnThis(), maybeSingle: lookup };
  service
    .mockReset()
    .mockResolvedValue({ from: () => ({ select: () => query }), rpc: link });
});
describe("recoverDepositCheckoutAction", () => {
  it("rejects invalid ids before database access", async () => {
    expect((await recoverDepositCheckoutAction("invalid")).status).toBe(
      "error",
    );
    expect(session).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
  });
  it("preserves the vendor auth guard", async () => {
    session.mockRejectedValue(new Error("not authenticated"));
    await expect(recoverDepositCheckoutAction(bookingId)).rejects.toThrow(
      "not authenticated",
    );
    expect(service).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "offline" } },
  ])("does not elevate a missing or inaccessible booking", async (result) => {
    bookingRead.mockResolvedValue(result);
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(service).not.toHaveBeenCalled();
  });
  it("rejects cancelled bookings", async () => {
    bookingRead.mockResolvedValue({
      data: { ...booking, status: "cancelled" },
      error: null,
    });
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(service).not.toHaveBeenCalled();
  });
  it("is a no-op when already linked", async () => {
    bookingRead.mockResolvedValue({
      data: { ...booking, deposit_transaction_id: txId },
      error: null,
    });
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe("ok");
    expect(service).not.toHaveBeenCalled();
  });
  it("reuses the original checkout with vendor, kit, and order scoping", async () => {
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe("ok");
    expect(transactionFilter).toHaveBeenCalledWith("vendor_id", vendorId);
    expect(transactionFilter).toHaveBeenCalledWith("kit_slug", "paykit");
    expect(transactionFilter).toHaveBeenCalledWith(
      "order_ref",
      "booking:" + bookingId + ":deposit",
    );
    expect(checkout).not.toHaveBeenCalled();
    expect(link).toHaveBeenCalledWith("link_booking_deposit", {
      p_booking_id: bookingId,
      p_vendor_id: vendorId,
      p_transaction_id: txId,
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      "/dashboard/bookings/" + bookingId,
    );
  });
  it.each([
    { data: null, error: { message: "offline" } },
    { data: { id: txId, amount_cents: 1 }, error: null },
  ])("rejects lookup failure or a conflicting amount", async (result) => {
    lookup.mockResolvedValue(result);
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(checkout).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
  });
  it("creates a checkout only when no prior transaction exists", async () => {
    lookup.mockResolvedValue({ data: null, error: null });
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe("ok");
    expect(checkout).toHaveBeenCalledWith({
      vendorId,
      kitSlug: "paykit",
      orderRef: "booking:" + bookingId + ":deposit",
      amountCents: 30000,
    });
  });
  it("handles a rejected checkout without losing the recovery path", async () => {
    lookup.mockResolvedValue({ data: null, error: null });
    checkout.mockRejectedValue(new Error("network failure"));
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(link).not.toHaveBeenCalled();
  });
  it("returns an actionable error when checkout configuration is unavailable", async () => {
    lookup.mockResolvedValue({ data: null, error: null });
    checkout.mockResolvedValue({
      ok: false,
      status: 422,
      error: "missing config",
    });
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(link).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "cancelled concurrently" } },
    { data: null, error: null },
  ])(
    "does not report success when the atomic link did not complete",
    async (result) => {
      link.mockResolvedValue(result);
      expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
        "error",
      );
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
  it("handles rejected transaction reads as a recoverable outage", async () => {
    lookup.mockRejectedValue(new Error("offline"));
    expect((await recoverDepositCheckoutAction(bookingId)).status).toBe(
      "error",
    );
    expect(link).not.toHaveBeenCalled();
  });
});

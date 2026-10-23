import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const {
  getVendorSessionMock,
  createServiceClientMock,
  createCheckoutMock,
  recordAuditMock,
  insertSingleMock,
  serviceDeleteMock,
  serviceUpdateEqMock,
  serviceLinkMock,
  vendorBookingMaybeSingleMock,
  vendorUpdateEqMock,
  refundsInsertMock,
  linkInquiryMock,
} = vi.hoisted(() => ({
  getVendorSessionMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  createCheckoutMock: vi.fn(),
  recordAuditMock: vi.fn(),
  insertSingleMock: vi.fn(),
  serviceDeleteMock: vi.fn(),
  serviceUpdateEqMock: vi.fn(),
  serviceLinkMock: vi.fn(),
  vendorBookingMaybeSingleMock: vi.fn(),
  vendorUpdateEqMock: vi.fn(),
  refundsInsertMock: vi.fn(),
  linkInquiryMock: vi.fn(),
}));

vi.mock("@/lib/vendor-session", () => ({
  getVendorSession: getVendorSessionMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));
vi.mock("@/lib/checkout", () => ({ createCheckout: createCheckoutMock }));
vi.mock("@/lib/admin-audit", () => ({ recordAudit: recordAuditMock }));
vi.mock("@/lib/inquiry-link", () => ({
  linkInquiryToBooking: linkInquiryMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const VENDOR_SUPABASE = {
  from: (table: string) => {
    if (table === "refunds") return { insert: refundsInsertMock };
    if (table !== "bookings") throw new Error(`unexpected table ${table}`);
    return {
      insert: () => ({ select: () => ({ single: insertSingleMock }) }),
      select: () => ({
        eq: () => ({ maybeSingle: vendorBookingMaybeSingleMock }),
      }),
      update: () => ({ eq: vendorUpdateEqMock }),
    };
  },
};

const SERVICE_SUPABASE = {
  rpc: serviceLinkMock,
  from: (table: string) => {
    if (table !== "bookings") throw new Error(`unexpected table ${table}`);
    return {
      delete: () => ({ eq: serviceDeleteMock }),
      update: () => ({ eq: serviceUpdateEqMock }),
    };
  },
};

beforeEach(() => {
  getVendorSessionMock
    .mockReset()
    .mockResolvedValue({ supabase: VENDOR_SUPABASE, user: { id: "v1" } });
  createServiceClientMock.mockReset().mockResolvedValue(SERVICE_SUPABASE);
  createCheckoutMock.mockReset().mockResolvedValue({
    ok: true,
    type: "qr",
    transaction_id: "tx-deposit",
    payload: "0002...",
  });
  recordAuditMock.mockReset().mockResolvedValue(undefined);
  insertSingleMock.mockReset().mockResolvedValue({
    data: { id: "b1" },
    error: null,
  });
  serviceLinkMock.mockReset().mockResolvedValue({ data: "b1", error: null });
  serviceDeleteMock.mockReset().mockResolvedValue({ error: null });
  serviceUpdateEqMock.mockReset().mockResolvedValue({ error: null });
  vendorBookingMaybeSingleMock.mockReset().mockResolvedValue({
    data: {
      id: "b1",
      status: "deposit_paid",
      event_date: "2026-12-01",
      balance_due_date: "2026-11-24",
      balance_amount_cents: 70000,
      deposit_transaction_id: "tx-deposit",
      balance_transaction_id: null,
    },
    error: null,
  });
  vendorUpdateEqMock.mockReset().mockResolvedValue({ error: null });
  refundsInsertMock.mockReset().mockResolvedValue({ error: null });
  vi.mocked(revalidatePath).mockReset();
  linkInquiryMock.mockReset().mockResolvedValue(true);
});

const VALID_BOOKING_ID = "11111111-1111-1111-1111-111111111111";
const VALID_TX_ID = "22222222-2222-2222-2222-222222222222";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID_BOOKING_FIELDS = {
  customer_name: "Jane Tan",
  customer_phone: "+6591234567",
  event_date: "2026-12-01",
  balance_due_date: "2026-11-24",
  total_amount: "1000.00",
  deposit_amount: "300.00",
  balance_amount: "700.00",
};

describe("createBookingAction", () => {
  it("links the inquiry it was converted from", async () => {
    const { createBookingAction } = await import("./actions");
    const inquiryId = "33333333-3333-3333-3333-333333333333";
    const result = await createBookingAction(
      { status: "idle" },
      formData({ ...VALID_BOOKING_FIELDS, inquiry_id: inquiryId }),
    );
    expect(result.status).toBe("ok");
    expect(linkInquiryMock).toHaveBeenCalledWith("v1", inquiryId, "b1");
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/bookings/inquiries/${inquiryId}`,
    );
  });

  it("ignores a malformed inquiry id and links nothing without one", async () => {
    const { createBookingAction } = await import("./actions");
    await createBookingAction(
      { status: "idle" },
      formData({ ...VALID_BOOKING_FIELDS, inquiry_id: "nope" }),
    );
    await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(linkInquiryMock).not.toHaveBeenCalled();
  });

  it("keeps the booking when linking the inquiry throws", async () => {
    const { createBookingAction } = await import("./actions");
    linkInquiryMock.mockRejectedValue(new Error("down"));
    const result = await createBookingAction(
      { status: "idle" },
      formData({
        ...VALID_BOOKING_FIELDS,
        inquiry_id: "33333333-3333-3333-3333-333333333333",
      }),
    );
    expect(result.status).toBe("ok");
  });

  it("creates a booking and its deposit checkout, linking the transaction id", async () => {
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(result.status).toBe("ok");
    expect(insertSingleMock).toHaveBeenCalled();
    expect(createCheckoutMock).toHaveBeenCalledWith({
      vendorId: "v1",
      kitSlug: "paykit",
      orderRef: "booking:b1:deposit",
      amountCents: 30000,
    });
    expect(recordAuditMock).toHaveBeenCalledWith("v1", "create_booking", "b1", {
      event_date: "2026-12-01",
      total_amount_cents: 100000,
      deposit_amount_cents: 30000,
      balance_amount_cents: 70000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("rejects invalid input without inserting or logging", async () => {
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData({ ...VALID_BOOKING_FIELDS, customer_name: "" }),
    );
    expect(result.status).toBe("error");
    expect(insertSingleMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("rejects when deposit + balance don't add up to the total", async () => {
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData({ ...VALID_BOOKING_FIELDS, deposit_amount: "999.00" }),
    );
    expect(result.status).toBe("error");
    expect(insertSingleMock).not.toHaveBeenCalled();
  });

  it("returns an error when the booking insert fails, without logging", async () => {
    insertSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(result.status).toBe("error");
    expect(createCheckoutMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("retains a saved booking and explains deposit recovery when checkout fails", async () => {
    createCheckoutMock.mockResolvedValue({
      ok: false,
      status: 422,
      error: "vendor has no PayNow config",
    });
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(result.status).toBe("ok");
    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });
});

describe("createBalanceCheckoutAction", () => {
  it("creates the balance checkout and links it", async () => {
    createCheckoutMock.mockResolvedValue({
      ok: true,
      type: "qr",
      transaction_id: "tx-balance",
      payload: "0002...",
    });
    const { createBalanceCheckoutAction } = await import("./actions");
    const result = await createBalanceCheckoutAction(VALID_BOOKING_ID);
    expect(result.status).toBe("ok");
    expect(createCheckoutMock).toHaveBeenCalledWith({
      vendorId: "v1",
      kitSlug: "paykit",
      orderRef: "booking:b1:balance",
      amountCents: 70000,
    });
    expect(serviceLinkMock).toHaveBeenCalledWith("link_booking_balance", {
      p_booking_id: "b1",
      p_vendor_id: "v1",
      p_transaction_id: "tx-balance",
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "create_balance_checkout",
      "b1",
      { amount_cents: 70000 },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings/b1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("rejects a malformed booking id without logging", async () => {
    const { createBalanceCheckoutAction } = await import("./actions");
    const result = await createBalanceCheckoutAction("not-a-uuid");
    expect(result.status).toBe("error");
    expect(createCheckoutMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("errors when the booking has no deposit transaction yet", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: "b1",
        balance_amount_cents: 70000,
        deposit_transaction_id: null,
        balance_transaction_id: null,
      },
      error: null,
    });
    const { createBalanceCheckoutAction } = await import("./actions");
    const result = await createBalanceCheckoutAction(VALID_BOOKING_ID);
    expect(result.status).toBe("error");
    expect(createCheckoutMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("errors when the balance checkout already exists", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: "b1",
        balance_amount_cents: 70000,
        deposit_transaction_id: "tx-deposit",
        balance_transaction_id: "tx-balance",
      },
      error: null,
    });
    const { createBalanceCheckoutAction } = await import("./actions");
    const result = await createBalanceCheckoutAction(VALID_BOOKING_ID);
    expect(result.status).toBe("error");
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it("errors when the booking isn't found (or isn't this vendor's)", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { createBalanceCheckoutAction } = await import("./actions");
    const result = await createBalanceCheckoutAction(VALID_BOOKING_ID);
    expect(result.status).toBe("error");
  });
});

describe("cancelBookingAction", () => {
  it("cancels a booking and records an audit row with the reason", async () => {
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(
      VALID_BOOKING_ID,
      "Customer rescheduled",
    );
    expect(result.status).toBe("ok");
    expect(vendorUpdateEqMock).toHaveBeenCalledWith("id", VALID_BOOKING_ID);
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "cancel_booking",
      VALID_BOOKING_ID,
      {
        reason: "Customer rescheduled",
        refund_transaction_id: null,
        refund_amount_cents: null,
        refund_recorded: null,
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/bookings/${VALID_BOOKING_ID}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("records a null reason when none was given", async () => {
    const { cancelBookingAction } = await import("./actions");
    await cancelBookingAction(VALID_BOOKING_ID);
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "cancel_booking",
      VALID_BOOKING_ID,
      {
        reason: null,
        refund_transaction_id: null,
        refund_amount_cents: null,
        refund_recorded: null,
      },
    );
  });

  it("rejects a malformed booking id without reading or updating", async () => {
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction("not-a-uuid");
    expect(result.status).toBe("error");
    expect(vendorBookingMaybeSingleMock).not.toHaveBeenCalled();
    expect(vendorUpdateEqMock).not.toHaveBeenCalled();
  });

  it("is a no-op success when the booking is already cancelled", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: "b1",
        status: "cancelled",
        deposit_transaction_id: "tx-deposit",
        balance_transaction_id: null,
      },
      error: null,
    });
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(VALID_BOOKING_ID);
    expect(result.status).toBe("ok");
    expect(vendorUpdateEqMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("returns not-found and logs nothing when the booking isn't found or isn't owned (regression: RLS silently no-ops UPDATE on a non-owned row)", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(VALID_BOOKING_ID);
    expect(result.status).toBe("error");
    expect(vendorUpdateEqMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when the update fails", async () => {
    vendorUpdateEqMock.mockResolvedValue({
      error: { message: "row-level security policy" },
    });
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(VALID_BOOKING_ID);
    expect(result.status).toBe("error");
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("records a refund against the given transaction when provided", async () => {
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(VALID_BOOKING_ID, "Full refund", {
      transactionId: VALID_TX_ID,
      amountCents: 30000,
    });
    expect(result.status).toBe("ok");
    expect(refundsInsertMock).toHaveBeenCalledWith({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: 30000,
      reason: "Full refund",
      created_by: "v1",
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "cancel_booking",
      VALID_BOOKING_ID,
      {
        reason: "Full refund",
        refund_transaction_id: VALID_TX_ID,
        refund_amount_cents: 30000,
        refund_recorded: true,
      },
    );
  });

  it("still cancels but flags the refund as not recorded when the refund insert fails (e.g. not Pro, or transaction not confirmed)", async () => {
    refundsInsertMock.mockResolvedValue({
      error: { message: "row-level security policy" },
    });
    const { cancelBookingAction } = await import("./actions");
    const result = await cancelBookingAction(VALID_BOOKING_ID, undefined, {
      transactionId: VALID_TX_ID,
      amountCents: 30000,
    });
    expect(result.status).toBe("ok");
    expect(result.message).toMatch(/refund/i);
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "cancel_booking",
      VALID_BOOKING_ID,
      {
        reason: null,
        refund_transaction_id: VALID_TX_ID,
        refund_amount_cents: 30000,
        refund_recorded: false,
      },
    );
  });
});

describe("rescheduleBookingAction", () => {
  it("reschedules a booking and records the previous and new dates", async () => {
    const { rescheduleBookingAction } = await import("./actions");
    const result = await rescheduleBookingAction(
      VALID_BOOKING_ID,
      "2027-01-15",
      "2027-01-08",
    );
    expect(result.status).toBe("ok");
    expect(vendorUpdateEqMock).toHaveBeenCalledWith("id", VALID_BOOKING_ID);
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "reschedule_booking",
      VALID_BOOKING_ID,
      {
        previous_event_date: "2026-12-01",
        previous_balance_due_date: "2026-11-24",
        new_event_date: "2027-01-15",
        new_balance_due_date: "2027-01-08",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/dashboard/bookings/${VALID_BOOKING_ID}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });

  it("rejects a balance-due date after the event date without reading", async () => {
    const { rescheduleBookingAction } = await import("./actions");
    const result = await rescheduleBookingAction(
      VALID_BOOKING_ID,
      "2027-01-01",
      "2027-01-15",
    );
    expect(result.status).toBe("error");
    expect(vendorBookingMaybeSingleMock).not.toHaveBeenCalled();
  });

  it("errors when the booking isn't found or isn't owned", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { rescheduleBookingAction } = await import("./actions");
    const result = await rescheduleBookingAction(
      VALID_BOOKING_ID,
      "2027-01-15",
      "2027-01-08",
    );
    expect(result.status).toBe("error");
    expect(vendorUpdateEqMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("refuses to reschedule an already-cancelled booking", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: "b1",
        status: "cancelled",
        event_date: "2026-12-01",
        balance_due_date: "2026-11-24",
      },
      error: null,
    });
    const { rescheduleBookingAction } = await import("./actions");
    const result = await rescheduleBookingAction(
      VALID_BOOKING_ID,
      "2027-01-15",
      "2027-01-08",
    );
    expect(result.status).toBe("error");
    expect(vendorUpdateEqMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when the update fails", async () => {
    vendorUpdateEqMock.mockResolvedValue({
      error: { message: "row-level security policy" },
    });
    const { rescheduleBookingAction } = await import("./actions");
    const result = await rescheduleBookingAction(
      VALID_BOOKING_ID,
      "2027-01-15",
      "2027-01-08",
    );
    expect(result.status).toBe("error");
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});

describe("saved booking recovery outcomes", () => {
  it("uses the atomic linking RPC for a normal deposit", async () => {
    const { createBookingAction } = await import("./actions");
    await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(serviceLinkMock).toHaveBeenCalledWith("link_booking_deposit", {
      p_booking_id: "b1",
      p_vendor_id: "v1",
      p_transaction_id: "tx-deposit",
    });
    expect(serviceUpdateEqMock).not.toHaveBeenCalled();
  });
  it("preserves a saved booking when checkout rejects", async () => {
    createCheckoutMock.mockRejectedValue(new Error("network failure"));
    const { createBookingAction } = await import("./actions");
    const result = await createBookingAction(
      { status: "idle" },
      formData(VALID_BOOKING_FIELDS),
    );
    expect(result).toEqual({
      status: "ok",
      message: "Booking saved. Open it and retry the deposit checkout.",
    });
    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(serviceLinkMock).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "link failed" } },
    { data: null, error: null },
  ])(
    "preserves the saved booking when the atomic link does not complete",
    async (result) => {
      serviceLinkMock.mockResolvedValue(result);
      const { createBookingAction } = await import("./actions");
      expect(
        await createBookingAction(
          { status: "idle" },
          formData(VALID_BOOKING_FIELDS),
        ),
      ).toMatchObject({
        status: "ok",
        message: expect.stringContaining("retry the deposit checkout"),
      });
      expect(serviceDeleteMock).not.toHaveBeenCalled();
    },
  );
  it("handles a rejected atomic link without inviting duplicate bookings", async () => {
    serviceLinkMock.mockRejectedValue(new Error("offline"));
    const { createBookingAction } = await import("./actions");
    expect(
      (
        await createBookingAction(
          { status: "idle" },
          formData(VALID_BOOKING_FIELDS),
        )
      ).status,
    ).toBe("ok");
    expect(serviceDeleteMock).not.toHaveBeenCalled();
  });
  it("does not report a saved booking as failed when audit delivery rejects", async () => {
    recordAuditMock.mockRejectedValue(new Error("audit offline"));
    const { createBookingAction } = await import("./actions");
    expect(
      (
        await createBookingAction(
          { status: "idle" },
          formData(VALID_BOOKING_FIELDS),
        )
      ).status,
    ).toBe("ok");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
  });
});

describe("balance checkout failure boundaries", () => {
  it("rejects cancelled bookings before creating a checkout", async () => {
    vendorBookingMaybeSingleMock.mockResolvedValue({
      data: { id: "b1", status: "cancelled" },
      error: null,
    });
    const { createBalanceCheckoutAction } = await import("./actions");
    expect((await createBalanceCheckoutAction(VALID_BOOKING_ID)).status).toBe(
      "error",
    );
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "invalid booking" } },
  ])("does not report success for an unlinked balance %j", async (result) => {
    serviceLinkMock.mockResolvedValue(result);
    const { createBalanceCheckoutAction } = await import("./actions");
    expect((await createBalanceCheckoutAction(VALID_BOOKING_ID)).status).toBe(
      "error",
    );
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
  it.each(["checkout", "service", "link"])(
    "returns a retryable error on %s rejection",
    async (stage) => {
      if (stage === "checkout")
        createCheckoutMock.mockRejectedValue(new Error("offline"));
      if (stage === "service")
        createServiceClientMock.mockRejectedValue(new Error("offline"));
      if (stage === "link")
        serviceLinkMock.mockRejectedValue(new Error("offline"));
      const { createBalanceCheckoutAction } = await import("./actions");
      expect((await createBalanceCheckoutAction(VALID_BOOKING_ID)).status).toBe(
        "error",
      );
      expect(recordAuditMock).not.toHaveBeenCalled();
    },
  );
  it("does not link a returned checkout failure", async () => {
    createCheckoutMock.mockResolvedValue({
      ok: false,
      status: 422,
      error: "no config",
    });
    const { createBalanceCheckoutAction } = await import("./actions");
    expect((await createBalanceCheckoutAction(VALID_BOOKING_ID)).status).toBe(
      "error",
    );
    expect(serviceLinkMock).not.toHaveBeenCalled();
  });
  it("keeps a linked checkout successful when audit logging rejects", async () => {
    recordAuditMock.mockRejectedValue(new Error("offline"));
    const { createBalanceCheckoutAction } = await import("./actions");
    expect((await createBalanceCheckoutAction(VALID_BOOKING_ID)).status).toBe(
      "ok",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/bookings/b1");
  });
});

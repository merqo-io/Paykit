import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const {
  verifyKitAuthMock,
  bookingMaybeSingleMock,
  txInMock,
  createServiceClientMock,
} = vi.hoisted(() => ({
  verifyKitAuthMock: vi.fn(),
  bookingMaybeSingleMock: vi.fn(),
  txInMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue({
    from: (table: string) => {
      if (table === "bookings")
        return {
          select: () => ({
            eq: () => ({ maybeSingle: bookingMaybeSingleMock }),
          }),
        };
      return { select: () => ({ in: txInMock }) };
    },
  });
  bookingMaybeSingleMock.mockReset();
  txInMock.mockReset().mockResolvedValue({ data: [], error: null });
});

const BOOKING_ID = "22222222-2222-2222-8222-222222222222";
const DEPOSIT_TX = "33333333-3333-3333-8333-333333333333";
const BALANCE_TX = "44444444-4444-4444-8444-444444444444";

function getReq() {
  return new Request(`http://localhost/api/v1/bookings/${BOOKING_ID}`, {
    headers: { authorization: "Bearer qkit:secret" },
  });
}
function ctx(booking_id: string = BOOKING_ID) {
  return { params: Promise.resolve({ booking_id }) };
}

describe("GET /api/v1/bookings/[booking_id]", () => {
  it("returns full booking status with both transactions confirmed", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: BOOKING_ID,
        status: "fully_paid",
        event_date: "2026-09-01",
        deposit_amount_cents: 20000,
        balance_amount_cents: 30000,
        total_amount_cents: 50000,
        deposit_transaction_id: DEPOSIT_TX,
        balance_transaction_id: BALANCE_TX,
      },
      error: null,
    });
    txInMock.mockResolvedValue({
      data: [
        { id: DEPOSIT_TX, status: "confirmed" },
        { id: BALANCE_TX, status: "confirmed" },
      ],
      error: null,
    });

    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      booking_id: BOOKING_ID,
      status: "fully_paid",
      event_date: "2026-09-01",
      deposit_amount_cents: 20000,
      balance_amount_cents: 30000,
      total_amount_cents: 50000,
      deposit_confirmed: true,
      balance_confirmed: true,
    });
  });

  it("reports balance_confirmed false when no balance transaction exists yet", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: BOOKING_ID,
        status: "deposit_paid",
        event_date: "2026-09-01",
        deposit_amount_cents: 20000,
        balance_amount_cents: 30000,
        total_amount_cents: 50000,
        deposit_transaction_id: DEPOSIT_TX,
        balance_transaction_id: null,
      },
      error: null,
    });
    txInMock.mockResolvedValue({
      data: [{ id: DEPOSIT_TX, status: "confirmed" }],
      error: null,
    });

    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual(
      expect.objectContaining({
        deposit_confirmed: true,
        balance_confirmed: false,
      }),
    );
    expect(txInMock).toHaveBeenCalledWith("id", [DEPOSIT_TX]);
  });

  it("reports both confirmed flags false while deposit is only pending/claimed", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: BOOKING_ID,
        status: "pending_deposit",
        event_date: "2026-09-01",
        deposit_amount_cents: 20000,
        balance_amount_cents: 30000,
        total_amount_cents: 50000,
        deposit_transaction_id: DEPOSIT_TX,
        balance_transaction_id: null,
      },
      error: null,
    });
    txInMock.mockResolvedValue({
      data: [{ id: DEPOSIT_TX, status: "claimed" }],
      error: null,
    });

    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual(
      expect.objectContaining({
        deposit_confirmed: false,
        balance_confirmed: false,
      }),
    );
  });

  it("skips the transaction lookup entirely when neither id is set", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: BOOKING_ID,
        status: "pending_deposit",
        event_date: "2026-09-01",
        deposit_amount_cents: 20000,
        balance_amount_cents: 30000,
        total_amount_cents: 50000,
        deposit_transaction_id: null,
        balance_transaction_id: null,
      },
      error: null,
    });

    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual(
      expect.objectContaining({
        deposit_confirmed: false,
        balance_confirmed: false,
      }),
    );
    expect(txInMock).not.toHaveBeenCalled();
  });

  it("401s when unauthorized", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    expect((await GET(getReq(), ctx())).status).toBe(401);
  });

  it("400s for a malformed (non-uuid) booking_id, without querying the DB", async () => {
    const res = await GET(getReq(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(bookingMaybeSingleMock).not.toHaveBeenCalled();
  });

  it("404s when the booking does not exist", async () => {
    bookingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(404);
  });

  it("503s when the booking read fails", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });

  it("503s when the transaction read fails", async () => {
    bookingMaybeSingleMock.mockResolvedValue({
      data: {
        id: BOOKING_ID,
        status: "deposit_paid",
        event_date: "2026-09-01",
        deposit_amount_cents: 20000,
        balance_amount_cents: 30000,
        total_amount_cents: 50000,
        deposit_transaction_id: DEPOSIT_TX,
        balance_transaction_id: null,
      },
      error: null,
    });
    txInMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });
});

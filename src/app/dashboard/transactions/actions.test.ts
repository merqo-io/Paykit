import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

const { getUserMock, insertMock, createServerClientMock, recordAuditMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    insertMock: vi.fn(),
    createServerClientMock: vi.fn(),
    recordAuditMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// recordAudit is exercised directly in `src/app/admin/actions.test.ts`
// (including its own service-client insert + best-effort-failure paths);
// here we only assert this action calls it with the right arguments.
vi.mock("@/lib/admin-audit", () => ({ recordAudit: recordAuditMock }));

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "v1" } } });
  insertMock.mockReset().mockResolvedValue({ error: null });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: () => ({ insert: insertMock }),
  });
  vi.mocked(revalidatePath).mockReset();
  recordAuditMock.mockReset().mockResolvedValue(undefined);
});

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID_TX_ID = "11111111-1111-1111-8111-111111111111";

describe("issueRefundAction", () => {
  it("inserts a refund row for a valid dollar amount, converted to cents", async () => {
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "4.50",
        reason: "damaged",
      }),
    );
    expect(result.status).toBe("ok");
    expect(insertMock).toHaveBeenCalledWith({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: 450,
      reason: "damaged",
      created_by: "v1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/transactions");
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "record_refund",
      VALID_TX_ID,
      { refunded_amount_cents: 450, reason: "damaged" },
    );
  });

  it("records the audit row with a null reason when none was given", async () => {
    const { issueRefundAction } = await import("./actions");
    await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "4.50",
        reason: "",
      }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      "v1",
      "record_refund",
      VALID_TX_ID,
      { refunded_amount_cents: 450, reason: null },
    );
  });

  it("does not record an audit row when the refund insert fails", async () => {
    insertMock.mockResolvedValue({
      error: { message: "new row violates row-level security policy" },
    });
    const { issueRefundAction } = await import("./actions");
    await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "4.50",
        reason: "",
      }),
    );
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount without inserting or revalidating", async () => {
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "0",
        reason: "",
      }),
    );
    expect(result.status).toBe("error");
    expect(insertMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a friendly error when the DB rejects the insert (e.g. RLS: not Pro / not confirmed)", async () => {
    insertMock.mockResolvedValue({
      error: { message: "new row violates row-level security policy" },
    });
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "4.50",
        reason: "",
      }),
    );
    expect(result.status).toBe("error");
    expect(insertMock).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed (non-UUID) transaction id via the Zod schema without touching the DB", async () => {
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: "not-a-uuid",
        refunded_amount: "4.50",
        reason: "",
      }),
    );
    expect(result.status).toBe("error");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a refund amount above the DB's int4 bound via the Zod schema without touching the DB", async () => {
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "99999999999",
        reason: "",
      }),
    );
    expect(result.status).toBe("error");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric dollar amount without inserting", async () => {
    const { issueRefundAction } = await import("./actions");
    const result = await issueRefundAction(
      { status: "idle" },
      formData({
        transaction_id: VALID_TX_ID,
        refunded_amount: "not-a-number",
        reason: "",
      }),
    );
    expect(result.status).toBe("error");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

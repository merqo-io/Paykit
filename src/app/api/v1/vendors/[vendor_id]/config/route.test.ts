import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

const {
  verifyKitAuthMock,
  maybeSingleMock,
  upsertMock,
  createServiceClientMock,
  removeMock,
} = vi.hoisted(() => ({
  verifyKitAuthMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  upsertMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  removeMock: vi.fn(),
}));

vi.mock("@/lib/kit-auth", () => ({ verifyKitAuth: verifyKitAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

beforeEach(() => {
  verifyKitAuthMock.mockReset().mockResolvedValue({ kitSlug: "qkit" });
  createServiceClientMock.mockReset().mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      upsert: upsertMock,
    }),
    storage: { from: () => ({ remove: removeMock }) },
  });
  maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
  removeMock.mockReset().mockResolvedValue({ error: null });
  upsertMock.mockReset().mockResolvedValue({ error: null });
});

const VENDOR_ID = "11111111-1111-1111-8111-111111111111";

function getReq() {
  return new Request(`http://localhost/api/v1/vendors/${VENDOR_ID}/config`, {
    headers: { authorization: "Bearer qkit:secret" },
  });
}
function postReq(body: unknown, authorization = "Bearer qkit:secret") {
  return new Request(`http://localhost/api/v1/vendors/${VENDOR_ID}/config`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function ctx(vendor_id: string = VENDOR_ID) {
  return { params: Promise.resolve({ vendor_id }) };
}

describe("GET /api/v1/vendors/[vendor_id]/config", () => {
  it("returns the full editable config for a paynow config", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
        mobile: null,
        label: null,
        url: null,
        qr_image_url: null,
      },
      error: null,
    });
    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual({
      has_config: true,
      display_name: "Kopitiam Cart",
      kind: "paynow",
      payee_name: "Kopitiam Cart",
      uen: "53312345A",
      mobile: null,
      label: null,
      url: null,
      qr_image_url: null,
    });
  });
  it("returns the full editable config for a pointer config", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        kind: "pointer",
        payee_name: null,
        uen: null,
        mobile: null,
        label: "Pay with PayLah",
        url: "https://pay.example/kopitiam",
        qr_image_url: null,
      },
      error: null,
    });
    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual({
      has_config: true,
      display_name: "Pay with PayLah",
      kind: "pointer",
      payee_name: null,
      uen: null,
      mobile: null,
      label: "Pay with PayLah",
      url: "https://pay.example/kopitiam",
      qr_image_url: null,
    });
  });
  it("reports has_config false and all-null fields when unconfigured", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await GET(getReq(), ctx());
    expect(await res.json()).toEqual({
      has_config: false,
      display_name: null,
      kind: null,
      payee_name: null,
      uen: null,
      mobile: null,
      label: null,
      url: null,
      qr_image_url: null,
    });
  });
  it("401s when unauthorized", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    expect((await GET(getReq(), ctx())).status).toBe(401);
  });
  it("400s for a malformed (non-uuid) vendor_id, without querying the DB", async () => {
    const res = await GET(getReq(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
  it("503s when the DB read fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const res = await GET(getReq(), ctx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });
});

describe("POST /api/v1/vendors/[vendor_id]/config", () => {
  it("upserts a paynow config and reports it back", async () => {
    const res = await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      has_config: true,
      display_name: "Kopitiam Cart",
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: VENDOR_ID,
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
        mobile: null,
      }),
      { onConflict: "vendor_id" },
    );
  });

  it("upserts a pointer config and reports it back", async () => {
    const res = await POST(
      postReq({
        kind: "pointer",
        label: "Pay with PayLah",
        url: "https://pay.example/kopitiam",
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      has_config: true,
      display_name: "Pay with PayLah",
    });
  });

  it("401s when unauthorized", async () => {
    verifyKitAuthMock.mockResolvedValue(null);
    const res = await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx(),
    );
    expect(res.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("400s for a malformed (non-uuid) vendor_id, without touching the DB", async () => {
    const res = await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx("not-a-uuid"),
    );
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("400s on an invalid body (both uen and mobile set)", async () => {
    const res = await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
        mobile: "+6591234567",
      }),
      ctx(),
    );
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("400s on a malformed JSON body", async () => {
    const req = new Request(
      `http://localhost/api/v1/vendors/${VENDOR_ID}/config`,
      {
        method: "POST",
        headers: { authorization: "Bearer qkit:secret" },
        body: "{not json",
      },
    );
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
  });

  it("503s when the upsert fails", async () => {
    upsertMock.mockResolvedValue({ error: { message: "connection reset" } });
    const res = await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx(),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).not.toMatch(/connection reset/);
  });

  it("deletes the QR image a save replaced, once the upsert succeeds", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { qr_image_url: `${PUBLIC}/booth-images/${VENDOR_ID}/old.webp` },
      error: null,
    });
    const res = await POST(
      postReq({
        kind: "pointer",
        label: "Pay with PayLah",
        qr_image_url: `${PUBLIC}/booth-images/${VENDOR_ID}/new.webp`,
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith([`${VENDOR_ID}/old.webp`]);
  });

  it("never deletes an object outside the vendor folder", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { qr_image_url: `${PUBLIC}/booth-images/someone-else/old.webp` },
      error: null,
    });
    await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx(),
    );
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("keeps the old QR image when the upsert fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { qr_image_url: `${PUBLIC}/booth-images/${VENDOR_ID}/old.webp` },
      error: null,
    });
    upsertMock.mockResolvedValue({ error: { message: "connection reset" } });
    await POST(
      postReq({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
      }),
      ctx(),
    );
    expect(removeMock).not.toHaveBeenCalled();
  });
});

const PUBLIC = "https://abc.supabase.co/storage/v1/object/public";

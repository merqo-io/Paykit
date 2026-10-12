import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyKitPaymentStatus,
  schedulePaymentStatusCallback,
} from "./kit-callback";

const { maybeSingleMock, eqMock, selectMock, fromMock, afterMock } = vi.hoisted(
  () => {
    const maybeSingleMock = vi.fn();
    const eqMock = vi.fn((..._args: unknown[]) => ({
      maybeSingle: maybeSingleMock,
    }));
    const selectMock = vi.fn((..._args: unknown[]) => ({ eq: eqMock }));
    const fromMock = vi.fn((..._args: unknown[]) => ({ select: selectMock }));
    return {
      maybeSingleMock,
      eqMock,
      selectMock,
      fromMock,
      afterMock: vi.fn(),
    };
  },
);
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => Promise.resolve({ from: fromMock }),
}));
vi.mock("next/server", () => ({ after: afterMock }));

const TX = {
  id: "22222222-2222-2222-2222-222222222222",
  kit_slug: "qkit",
  order_ref: "A-001",
  status: "claimed",
};
const CALLBACK_URL = "https://qkit.test/api/paykit/payment-status";
const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function configured(
  row: { callback_url: string | null; callback_secret: string | null } = {
    callback_url: CALLBACK_URL,
    callback_secret: "shared-secret",
  },
) {
  maybeSingleMock.mockResolvedValue({ data: row, error: null });
}

beforeEach(() => {
  maybeSingleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
  afterMock.mockReset();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as unknown as typeof fetch;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  errorSpy.mockRestore();
  vi.useRealTimers();
});

describe("notifyKitPaymentStatus", () => {
  it("posts the transaction's status to the owning kit's callback", async () => {
    configured();
    await notifyKitPaymentStatus(TX);

    expect(fromMock).toHaveBeenCalledWith("kit_api_keys");
    expect(selectMock).toHaveBeenCalledWith("callback_url, callback_secret");
    expect(eqMock).toHaveBeenCalledWith("kit_slug", "qkit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(CALLBACK_URL);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({
      Authorization: "Bearer shared-secret",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      order_ref: "A-001",
      transaction_id: TX.id,
      status: "claimed",
    });
  });

  it.each([
    ["no row for the kit", null],
    ["no callback_url", { callback_url: null, callback_secret: "s" }],
    [
      "no callback_secret",
      { callback_url: CALLBACK_URL, callback_secret: null },
    ],
    ["an empty callback_url", { callback_url: "", callback_secret: "s" }],
  ])("sends nothing when the kit has %s", async (_, row) => {
    maybeSingleMock.mockResolvedValue({ data: row, error: null });
    await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each(["http://qkit.test/api/paykit/payment-status", "not a url"])(
    "sends nothing, and logs, when callback_url is %s",
    async (callback_url) => {
      configured({ callback_url, callback_secret: "shared-secret" });
      await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    },
  );

  it("sends nothing when the transaction's status is not a payment status", async () => {
    configured();
    await notifyKitPaymentStatus({ ...TX, status: "refunded" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when the kit_api_keys read returns an error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when the kit_api_keys read rejects", async () => {
    maybeSingleMock.mockRejectedValue(new Error("database unavailable"));
    await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when the callback request rejects", async () => {
    configured();
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw on a non-2xx answer, and never logs the secret", async () => {
    configured();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(notifyKitPaymentStatus(TX)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("shared-secret");
  });

  it("gives up after 5 seconds", async () => {
    vi.useFakeTimers();
    configured();
    fetchMock.mockImplementation(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const done = notifyKitPaymentStatus(TX);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(done).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe("schedulePaymentStatusCallback", () => {
  it("registers the callback to run after the response, without sending it yet", () => {
    configured();
    schedulePaymentStatusCallback(TX);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the callback when the registered work runs", async () => {
    configured();
    schedulePaymentStatusCallback(TX);
    const work = afterMock.mock.calls[0][0] as () => Promise<void>;
    await work();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

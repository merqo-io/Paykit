import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inquiryAlertText, sendInquiryAlert } from "./inquiry-alert";

const VENDOR = "00000000-0000-4000-8000-00000000000a";
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.MERQO_BASE_URL = "https://merqo.example.com";
  process.env.MERQO_CUSTOMER_SECRET = "test-secret";
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("inquiryAlertText", () => {
  it("names the client and the event date, with no link", () => {
    const text = inquiryAlertText("Jane Tan", "2026-12-12");
    expect(text).toBe(
      "New paykit inquiry from Jane Tan, event 12/12/2026. Open Bookings in paykit to reply.",
    );
    expect(text).not.toMatch(/https?:/);
  });

  it("leaves the date out when none was given", () => {
    expect(inquiryAlertText("Jane Tan", "")).toBe(
      "New paykit inquiry from Jane Tan. Open Bookings in paykit to reply.",
    );
  });
});

describe("sendInquiryAlert", () => {
  it("posts to merqo's notify-vendor with the bearer secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    global.fetch = fetchMock;
    await sendInquiryAlert(VENDOR, "Jane Tan", undefined);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://merqo.example.com/api/merqo/notify-vendor");
    expect(init.headers.Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(init.body)).toEqual({
      vendor_id: VENDOR,
      message:
        "New paykit inquiry from Jane Tan. Open Bookings in paykit to reply.",
    });
  });

  it("never throws when merqo is down or refuses", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("down"));
    await expect(sendInquiryAlert(VENDOR, "J", "")).resolves.toBeUndefined();
    global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    await expect(sendInquiryAlert(VENDOR, "J", "")).resolves.toBeUndefined();
  });

  it("sends nothing without the secret", async () => {
    delete process.env.MERQO_CUSTOMER_SECRET;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    await sendInquiryAlert(VENDOR, "J", "");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

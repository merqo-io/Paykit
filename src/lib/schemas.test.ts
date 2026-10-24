import { describe, it, expect } from "vitest";
import {
  vendorPaymentConfigInputSchema,
  issueRefundInputSchema,
  supportMessageSchema,
  createBookingInputSchema,
  cancelBookingInputSchema,
  createBalanceCheckoutInputSchema,
} from "./schemas";

describe("vendorPaymentConfigInputSchema", () => {
  describe("kind: paynow", () => {
    it("accepts a valid UEN-only config", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
        mobile: "",
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts a valid mobile-only config", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "",
        mobile: "+6591234567",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects both uen and mobile set", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen: "53312345A",
        mobile: "+6591234567",
      });
      expect(parsed.success).toBe(false);
    });

    it.each([
      [
        "rejects neither uen nor mobile set",
        {
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen: "",
          mobile: "",
        },
      ],
      [
        "rejects an invalid UEN format",
        {
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen: "!!!",
          mobile: "",
        },
      ],
      [
        "rejects a bare 8-digit mobile number typed as a UEN",
        {
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen: "91234567",
          mobile: "",
        },
      ],
      [
        "rejects a UEN that does not end in a letter",
        {
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen: "533123456",
          mobile: "",
        },
      ],
    ])("%s", (_name, input) => {
      expect(vendorPaymentConfigInputSchema.safeParse(input).success).toBe(
        false,
      );
    });

    it.each(["53312345A", "201912345K", "T09LL0001B"])(
      "accepts the UEN %s",
      (uen) => {
        const parsed = vendorPaymentConfigInputSchema.safeParse({
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen,
          mobile: "",
        });
        expect(parsed.success).toBe(true);
      },
    );

    it.each(["53312345AX12", "201912345KA01", "T09LL0001B001"])(
      "accepts the UEN %s with a 3-character suffix",
      (uen) => {
        const parsed = vendorPaymentConfigInputSchema.safeParse({
          kind: "paynow",
          payee_name: "Kopitiam Cart",
          uen,
          mobile: "",
        });
        expect(parsed.success).toBe(true);
      },
    );

    it.each([
      ["8 characters ending in a letter", "5331234A"],
      ["a UEN followed by 1 extra character", "201912345KA"],
      ["a UEN followed by 2 extra characters", "53312345AX1"],
      ["a value longer than a UEN plus its suffix", "53312345AX1234"],
      ["12 digits", "912345678901"],
    ])("rejects %s as a UEN", (_label, uen) => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "paynow",
        payee_name: "Kopitiam Cart",
        uen,
        mobile: "",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects an empty payee name", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "paynow",
        payee_name: "",
        uen: "53312345A",
        mobile: "",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("kind: pointer", () => {
    it("accepts a valid payment-link config", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "pointer",
        label: "Pay with PayLah",
        url: "https://pay.example/kopitiam",
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts a valid QR-image config", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "pointer",
        label: "Scan our QR",
        qr_image_url: "https://cdn.example/qr.webp",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects both url and qr_image_url set", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "pointer",
        label: "Pay",
        url: "https://pay.example/kopitiam",
        qr_image_url: "https://cdn.example/qr.webp",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects neither url nor qr_image_url set", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "pointer",
        label: "Pay",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects an empty label", () => {
      const parsed = vendorPaymentConfigInputSchema.safeParse({
        kind: "pointer",
        label: "",
        url: "https://pay.example/kopitiam",
      });
      expect(parsed.success).toBe(false);
    });

    it.each([
      [
        "rejects an invalid url",
        {
          kind: "pointer",
          label: "Pay",
          url: "not-a-url",
        },
      ],
      [
        "rejects a javascript: url (stored-XSS vector via the checkout link a customer clicks)",
        {
          kind: "pointer",
          label: "Pay",
          url: "javascript:alert(document.cookie)",
        },
      ],
      [
        "rejects a data: qr_image_url",
        {
          kind: "pointer",
          label: "Scan our QR",
          qr_image_url: "data:text/html,<script>alert(1)</script>",
        },
      ],
      [
        "rejects a file: url",
        {
          kind: "pointer",
          label: "Pay",
          url: "file:///etc/passwd",
        },
      ],
    ])("%s", (_name, input) => {
      expect(vendorPaymentConfigInputSchema.safeParse(input).success).toBe(
        false,
      );
    });
  });
});

describe("issueRefundInputSchema", () => {
  const VALID_TX_ID = "11111111-1111-1111-8111-111111111111";

  it("accepts a valid refund input and coerces the amount to a number", () => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: "450",
      reason: "damaged",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.refunded_amount_cents).toBe(450);
    }
  });

  it("accepts an omitted reason", () => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: "450",
      reason: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-UUID transaction id", () => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: "not-a-uuid",
      refunded_amount_cents: "450",
      reason: "",
    });
    expect(parsed.success).toBe(false);
  });

  it.each(["0", "-1"])("rejects a non-positive amount: %s", (amount) => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: amount,
      reason: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-integer amount", () => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: "10.5",
      reason: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an amount above the Postgres int4 bound", () => {
    const parsed = issueRefundInputSchema.safeParse({
      transaction_id: VALID_TX_ID,
      refunded_amount_cents: "99999999999",
      reason: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createBookingInputSchema", () => {
  const VALID = {
    customer_name: "Jane Tan",
    customer_phone: "+6591234567",
    event_date: "2026-12-01",
    balance_due_date: "2026-11-24",
    total_amount_cents: "100000",
    deposit_amount_cents: "30000",
    balance_amount_cents: "70000",
  };

  it("accepts a valid booking and coerces amounts to numbers", () => {
    const parsed = createBookingInputSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.total_amount_cents).toBe(100000);
      expect(parsed.data.deposit_amount_cents).toBe(30000);
      expect(parsed.data.balance_amount_cents).toBe(70000);
    }
  });

  it("accepts an omitted customer phone", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      customer_phone: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty customer name", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      customer_name: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when deposit + balance don't add up to the total", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      deposit_amount_cents: "30000",
      balance_amount_cents: "80000",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a balance due date after the event date", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      balance_due_date: "2026-12-15",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a balance due date equal to the event date", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      balance_due_date: VALID.event_date,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed event date", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      event_date: "1 Dec 2026",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-positive deposit amount", () => {
    const parsed = createBookingInputSchema.safeParse({
      ...VALID,
      deposit_amount_cents: "0",
      balance_amount_cents: "100000",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("cancelBookingInputSchema", () => {
  const VALID_ID = "11111111-1111-1111-8111-111111111111";

  it("accepts a valid booking id with no reason", () => {
    const parsed = cancelBookingInputSchema.safeParse({
      booking_id: VALID_ID,
      reason: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid booking id with a reason", () => {
    const parsed = cancelBookingInputSchema.safeParse({
      booking_id: VALID_ID,
      reason: "Customer rescheduled elsewhere",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-UUID booking id", () => {
    const parsed = cancelBookingInputSchema.safeParse({
      booking_id: "not-a-uuid",
      reason: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createBalanceCheckoutInputSchema", () => {
  it("accepts a valid booking id", () => {
    const parsed = createBalanceCheckoutInputSchema.safeParse({
      booking_id: "11111111-1111-1111-8111-111111111111",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-UUID booking id", () => {
    const parsed = createBalanceCheckoutInputSchema.safeParse({
      booking_id: "not-a-uuid",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("supportMessageSchema", () => {
  it("accepts a valid payment-category message", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "payment",
      body: "My QR isn't generating.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "payment",
      body: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const parsed = supportMessageSchema.safeParse({
      category: "not-a-real-category",
      body: "Help",
    });
    expect(parsed.success).toBe(false);
  });
});

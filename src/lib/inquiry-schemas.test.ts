import { describe, it, expect } from "vitest";
import {
  inquiryFormSettingsSchema,
  inquiryStatusUpdateSchema,
  publicIdSchema,
  publicInquirySchema,
} from "./inquiry-schemas";

const settings = {
  business_name: "Kopi Cart Co",
  enabled: true,
  terms_url: "",
  terms_version: "",
};

const inquiry = {
  customer_name: "Jane Tan",
  customer_phone: "+65 9123 4567",
  event_date: "2026-12-12",
  message: "Wedding for 120 guests",
  terms_accepted: false,
};

describe("inquiryFormSettingsSchema", () => {
  it("accepts a form with no terms", () => {
    expect(inquiryFormSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it("accepts an https terms link with a version", () => {
    const r = inquiryFormSettingsSchema.safeParse({
      ...settings,
      terms_url: "https://example.com/terms.pdf",
      terms_version: "v2",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-https terms link", () => {
    for (const terms_url of ["http://example.com", "javascript:alert(1)"]) {
      const r = inquiryFormSettingsSchema.safeParse({
        ...settings,
        terms_url,
        terms_version: "v1",
      });
      expect(r.success).toBe(false);
    }
  });

  it("rejects a terms link without a version, and the reverse", () => {
    expect(
      inquiryFormSettingsSchema.safeParse({
        ...settings,
        terms_url: "https://example.com/t",
      }).success,
    ).toBe(false);
    expect(
      inquiryFormSettingsSchema.safeParse({ ...settings, terms_version: "v1" })
        .success,
    ).toBe(false);
  });

  it("rejects a blank or over-long business name", () => {
    expect(
      inquiryFormSettingsSchema.safeParse({ ...settings, business_name: " " })
        .success,
    ).toBe(false);
    expect(
      inquiryFormSettingsSchema.safeParse({
        ...settings,
        business_name: "x".repeat(81),
      }).success,
    ).toBe(false);
  });
});

describe("publicInquirySchema", () => {
  it("accepts a full inquiry and an empty event date", () => {
    expect(publicInquirySchema.safeParse(inquiry).success).toBe(true);
    expect(
      publicInquirySchema.safeParse({ ...inquiry, event_date: "" }).success,
    ).toBe(true);
  });

  it("rejects a phone with letters or the wrong length", () => {
    for (const customer_phone of ["call me", "12345", "1".repeat(21)]) {
      expect(
        publicInquirySchema.safeParse({ ...inquiry, customer_phone }).success,
      ).toBe(false);
    }
  });

  it("rejects an empty or over-long message", () => {
    expect(
      publicInquirySchema.safeParse({ ...inquiry, message: "" }).success,
    ).toBe(false);
    expect(
      publicInquirySchema.safeParse({ ...inquiry, message: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe("publicIdSchema", () => {
  it("accepts only 16 lowercase hex characters", () => {
    expect(publicIdSchema.safeParse("0123456789abcdef").success).toBe(true);
    expect(publicIdSchema.safeParse("0123456789ABCDEF").success).toBe(false);
    expect(publicIdSchema.safeParse("0123").success).toBe(false);
  });
});

describe("inquiryStatusUpdateSchema", () => {
  it("allows only contacted and declined", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      inquiryStatusUpdateSchema.safeParse({
        inquiry_id: id,
        status: "declined",
      }).success,
    ).toBe(true);
    expect(
      inquiryStatusUpdateSchema.safeParse({
        inquiry_id: id,
        status: "converted",
      }).success,
    ).toBe(false);
  });
});

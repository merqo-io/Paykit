import { z } from "zod";

// z.string().url() accepts any scheme, including javascript:/data:/file:.
// These fields are later rendered as a real href/src (the pointer url even
// reaches an end customer via the cross-kit checkout response), so restrict
// to http(s) here, at the validation boundary.
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
export function isHttpUrl(value: string): boolean {
  try {
    return HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
const HTTP_URL_MESSAGE = "Must be a valid http:// or https:// link";

const payNowInputSchema = z.object({
  kind: z.literal("paynow"),
  payee_name: z.string().trim().min(1, "Payee name is required").max(100),
  uen: z
    .string()
    .trim()
    // Every UEN format is 9 or 10 characters and ends in a check letter. An
    // 8-digit mobile number typed here would otherwise pass and produce a
    // QR that banking apps reject. qkit applies the same rule.
    .regex(/^[0-9A-Za-z]{8,9}[A-Za-z]$/, "Invalid UEN")
    .optional()
    .or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .regex(/^\+65\d{8}$/, "Use +65XXXXXXXX")
    .optional()
    .or(z.literal("")),
});

const pointerInputSchema = z.object({
  kind: z.literal("pointer"),
  label: z.string().trim().min(1, "Label is required").max(60),
  url: z
    .string()
    .trim()
    .url("Enter a valid link")
    .max(500)
    .refine(isHttpUrl, HTTP_URL_MESSAGE)
    .optional(),
  qr_image_url: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine(isHttpUrl, HTTP_URL_MESSAGE)
    .optional(),
});

export const vendorPaymentConfigInputSchema = z
  .discriminatedUnion("kind", [payNowInputSchema, pointerInputSchema])
  .transform((v) =>
    v.kind === "paynow"
      ? { ...v, uen: v.uen || undefined, mobile: v.mobile || undefined }
      : v,
  )
  .superRefine((v, ctx) => {
    if (v.kind === "paynow" && Boolean(v.uen) === Boolean(v.mobile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a UEN or a mobile number, not both",
        path: ["uen"],
      });
    }
    if (v.kind === "pointer" && Boolean(v.url) === Boolean(v.qr_image_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a payment link or a QR image, not both",
        path: ["url"],
      });
    }
  });

export type VendorPaymentConfigInput = z.infer<
  typeof vendorPaymentConfigInputSchema
>;

// Postgres `integer` (int4) upper bound — refunded_amount_cents is stored in
// an `integer` column (supabase/migrations/0001_paykit_core.sql), so this
// keeps the Zod boundary in sync with what the DB will actually accept.
const PG_INT4_MAX = 2147483647;

export const issueRefundInputSchema = z.object({
  transaction_id: z.string().uuid("Invalid transaction"),
  refunded_amount_cents: z.coerce
    .number({ invalid_type_error: "Enter a valid refund amount." })
    .int("Enter a valid refund amount.")
    .positive("Enter a valid refund amount.")
    .max(PG_INT4_MAX, "Amount is too large."),
  reason: z
    .string()
    .trim()
    .max(500, "Reason is too long")
    .optional()
    .or(z.literal("")),
});

export type IssueRefundInput = z.infer<typeof issueRefundInputSchema>;

// ── Bookings (dashboard/bookings) ────────────────────────────────────────
// A vendor's own `<input type="date">` gives an ISO "YYYY-MM-DD" string —
// zero-padded, so plain string comparison already sorts chronologically;
// no Date parsing needed for the ordering check below.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const createBookingInputSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .min(1, "Customer name is required")
      .max(100),
    customer_phone: z.string().trim().max(30).optional().or(z.literal("")),
    event_date: isoDate,
    balance_due_date: isoDate,
    total_amount_cents: z.coerce
      .number({ invalid_type_error: "Enter a valid total amount." })
      .int("Enter a valid total amount.")
      .positive("Enter a valid total amount.")
      .max(PG_INT4_MAX, "Amount is too large."),
    deposit_amount_cents: z.coerce
      .number({ invalid_type_error: "Enter a valid deposit amount." })
      .int("Enter a valid deposit amount.")
      .positive("Enter a valid deposit amount.")
      .max(PG_INT4_MAX, "Amount is too large."),
    balance_amount_cents: z.coerce
      .number({ invalid_type_error: "Enter a valid balance amount." })
      .int("Enter a valid balance amount.")
      .positive("Enter a valid balance amount.")
      .max(PG_INT4_MAX, "Amount is too large."),
  })
  .superRefine((v, ctx) => {
    if (
      v.deposit_amount_cents + v.balance_amount_cents !==
      v.total_amount_cents
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Deposit + balance must add up to the total",
        path: ["deposit_amount_cents"],
      });
    }
    if (v.balance_due_date > v.event_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Balance due date must be on or before the event date",
        path: ["balance_due_date"],
      });
    }
  });
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const cancelBookingInputSchema = z
  .object({
    booking_id: z.string().uuid("Invalid booking"),
    reason: z
      .string()
      .trim()
      .max(500, "Reason is too long")
      .optional()
      .or(z.literal("")),
    refund_transaction_id: z.string().uuid("Invalid transaction").optional(),
    refund_amount_cents: z.coerce
      .number({ invalid_type_error: "Enter a valid refund amount." })
      .int("Enter a valid refund amount.")
      .positive("Enter a valid refund amount.")
      .max(PG_INT4_MAX, "Amount is too large.")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (Boolean(v.refund_transaction_id) !== Boolean(v.refund_amount_cents)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide both a refund transaction and amount, or neither",
        path: ["refund_amount_cents"],
      });
    }
  });
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

export const createBalanceCheckoutInputSchema = z.object({
  booking_id: z.string().uuid("Invalid booking"),
});
export type CreateBalanceCheckoutInput = z.infer<
  typeof createBalanceCheckoutInputSchema
>;

export const rescheduleBookingInputSchema = z
  .object({
    booking_id: z.string().uuid("Invalid booking"),
    event_date: isoDate,
    balance_due_date: isoDate,
  })
  .superRefine((v, ctx) => {
    if (v.balance_due_date > v.event_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Balance due date must be on or before the event date",
        path: ["balance_due_date"],
      });
    }
  });
export type RescheduleBookingInput = z.infer<
  typeof rescheduleBookingInputSchema
>;

// ── Profile settings (dashboard/profile) ─────────────────────────────────
// Cross-kit standard, not paykit-specific — see `Merqo Business/docs/business/
// 2026-07-21-profile-settings-page-standard.md`. Stall/shop name + social
// links persist to the shared `merqo.vendor_profile` table (via
// merqo-vendor-profile.ts); display name, avatar, password live on the
// Supabase auth user and are written client-side.

export const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Stall / shop name is required").max(100),
});
export type ProfileNameInput = z.infer<typeof profileNameSchema>;

// Optional: an empty string clears it. Trimmed so trailing whitespace can't
// slip past max.
export const displayNameSchema = z.object({
  displayName: z.string().trim().max(60, "Display name is too long"),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;

// New password + confirm. Min length mirrors Supabase auth's own minimum (8);
// confirm must match.
export const passwordChangeSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

const socialUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(300)
  .refine(isHttpUrl, HTTP_URL_MESSAGE)
  .optional()
  .or(z.literal(""));

export const socialLinksSchema = z.object({
  website: socialUrl,
  instagram: socialUrl,
  facebook: socialUrl,
  tiktok: socialUrl,
});
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

export const feedbackSchema = z.object({
  nps: z.number().int().min(0).max(10),
  message: z.string().trim().max(2000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const supportMessageSchema = z.object({
  category: z.enum(["payment", "account", "billing", "other"]),
  body: z.string().trim().min(1, "Tell us what's wrong").max(2000),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const SUPPORT_CATEGORY_LABELS: Record<
  SupportMessageInput["category"],
  string
> = {
  payment: "Payment / checkout",
  account: "Account / sign-in",
  billing: "Pro plan",
  other: "Something else",
};

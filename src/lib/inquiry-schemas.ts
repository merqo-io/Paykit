import { z } from "zod";

const optionalIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .optional()
  .or(z.literal(""));

export const inquiryFormSettingsSchema = z
  .object({
    business_name: z
      .string()
      .trim()
      .min(1, "Business name is required")
      .max(80, "Business name is too long"),
    enabled: z.boolean(),
    terms_url: z
      .string()
      .trim()
      .max(500, "Link is too long")
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), {
        message: "Use an https:// link",
      }),
    terms_version: z.string().trim().max(40, "Version is too long"),
  })
  .superRefine((v, ctx) => {
    if ((v.terms_url === "") !== (v.terms_version === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Give both a terms link and a version, or neither",
        path: ["terms_version"],
      });
    }
  });
export type InquiryFormSettingsInput = z.infer<
  typeof inquiryFormSettingsSchema
>;

export const publicIdSchema = z.string().regex(/^[0-9a-f]{16}$/);

export const publicInquirySchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(80, "Name is too long"),
  customer_phone: z
    .string()
    .trim()
    .regex(/^[0-9+ -]{6,20}$/, "Enter a valid phone number"),
  event_date: optionalIsoDate,
  message: z
    .string()
    .trim()
    .min(1, "Tell the vendor about your event")
    .max(2000, "Message is too long"),
  terms_accepted: z.boolean(),
});
export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const inquiryStatusUpdateSchema = z.object({
  inquiry_id: z.string().uuid("Invalid inquiry"),
  status: z.enum(["contacted", "declined"]),
});

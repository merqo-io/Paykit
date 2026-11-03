import { z } from "zod";

// Copied verbatim from merqo's entitlement contract. Keep the two in lockstep:
// merqo is the sender and this schema is the receiving half of the wire
// contract.
const isoDate = z.string().datetime({ offset: true });

export const entitlementPayloadSchema = z
  .object({
    email: z.string().email(),
    kit: z.string().min(1),
    tier: z.enum(["free", "starter", "qkit", "paid"]),
    founder: z.boolean(),
    stats_window: z.enum(["24h", "90d"]),
    event_pass: z.object({ starts_at: isoDate, ends_at: isoDate }).nullable(),
    valid_until: isoDate.nullable(),
    issued_at: isoDate,
  })
  .refine(
    (p) =>
      p.kit === "qkit"
        ? p.tier !== "paid"
        : p.tier === "free" || p.tier === "paid",
    { message: "tier is not valid for this kit", path: ["tier"] },
  );

export type EntitlementPayload = z.infer<typeof entitlementPayloadSchema>;

// Pure data module for the BYO preset picker — no React, no I/O. See
// docs/superpowers/specs/2026-08-14-paykit-byo-preset-directory-design.md.

export type PointerPresetId = "stripe" | "hitpay" | "paylah" | "other";
type PointerPresetMode = "link" | "qr" | "choice";

export type PointerPreset = {
  id: PointerPresetId;
  cardLabel: string;
  // Pre-fills the `label` field; "" = leave blank.
  labelSuggestion: string;
  // "choice" = vendor still picks link vs QR (Other only).
  mode: PointerPresetMode;
  // "where to find this" copy shown under the field.
  instructions: string;
  // Soft validation only — never blocks save.
  urlPattern?: RegExp;
  urlWarning?: string;
};

export const POINTER_PRESETS: Record<PointerPresetId, PointerPreset> = {
  stripe: {
    id: "stripe",
    cardLabel: "Stripe Payment Link",
    labelSuggestion: "Pay with Stripe",
    mode: "link",
    instructions:
      "Stripe Dashboard → Payment Links → New → Create link, then copy the link (starts with buy.stripe.com).",
    urlPattern: /^https:\/\/buy\.stripe\.com\//,
    urlWarning:
      "This doesn't look like a Stripe Payment Link (usually starts with buy.stripe.com) — check you copied the right one.",
  },
  hitpay: {
    id: "hitpay",
    cardLabel: "HitPay Payment Link",
    labelSuggestion: "Pay with HitPay",
    mode: "link",
    instructions:
      "HitPay Dashboard → Payment Links → Create Payment Link, then copy the link it gives you.",
    // Anchored to the start of the URL, with an optional subdomain chain
    // (HitPay's own subdomain varies, e.g. securepayment.hit-pay.com) —
    // an unanchored /hit-pay\.com/ would also match an attacker-controlled
    // host like evil.com/hit-pay.com or hit-pay.com.attacker.example.
    urlPattern: /^https:\/\/([a-z0-9-]+\.)*hit-pay\.com(\/|$|\?|:)/i,
    urlWarning:
      "This doesn't look like a HitPay link (usually contains hit-pay.com) — check you copied the right one.",
  },
  paylah: {
    id: "paylah",
    cardLabel: "PayLah! QR",
    labelSuggestion: "Pay with PayLah!",
    mode: "qr",
    instructions:
      "Open DBS PayLah! → your QR code screen → screenshot or save the image, then upload it below.",
  },
  other: {
    id: "other",
    cardLabel: "Other / custom",
    labelSuggestion: "",
    mode: "choice",
    instructions:
      "Any other payment link or QR: GrabPay, ShopeePay, Qashier, your bank's own QR, or anything else that works.",
  },
};

export const POINTER_PRESET_ORDER: PointerPresetId[] = [
  "stripe",
  "hitpay",
  "paylah",
  "other",
];

/** Best-effort re-derivation for an existing saved config — see spec's
 * "Preset re-derivation on edit is best-effort" guiding decision. */
export function derivePointerPreset(config: {
  url: string | null;
  qr_image_url: string | null;
}): PointerPresetId {
  if (config.url && POINTER_PRESETS.stripe.urlPattern!.test(config.url))
    return "stripe";
  if (config.url && POINTER_PRESETS.hitpay.urlPattern!.test(config.url))
    return "hitpay";
  return "other";
}

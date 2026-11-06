// Shape of merqo.vendor_profile.social_links (shared across every kit — see
// merqo-vendor-profile.ts). Not a paykit table column, so it has no
// Insert/Update variant here.
export type SocialLinks = {
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
};
export type VendorPlan = "free" | "pro";
export type VerificationMethod = "manual" | "auto";

export type PaymentConfigKind = "paynow" | "pointer";

export type VendorPaymentConfig = {
  vendor_id: string;
  kind: PaymentConfigKind;
  uen: string | null;
  mobile: string | null;
  payee_name: string | null;
  label: string | null;
  url: string | null;
  qr_image_url: string | null;
  verification_method: VerificationMethod;
  created_at: string;
  updated_at: string;
};

export type VendorPrefs = {
  vendor_id: string;
  tour_seen_at: string | null;
};

export type VendorEntitlement = {
  vendor_id: string;
  tier: "free" | "paid";
  founder: boolean;
  stats_window: "24h" | "90d";
  event_pass_starts_at: string | null;
  event_pass_ends_at: string | null;
  valid_until: string | null;
  issued_at: string;
  updated_at: string;
};

export type LegalCheckState = {
  email: string;
  checked_at: string;
  is_current: boolean;
};

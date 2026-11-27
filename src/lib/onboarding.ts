export type OnboardingStepId = "paynow" | "preview" | "first-payment" | "gst";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string | null;
  done: boolean;
  /** Optional steps are shown but never counted or required. */
  optional: boolean;
  comingSoon: boolean;
};

export type OnboardingInput = {
  /** A vendor_payment_config row exists. */
  hasConfig: boolean;
  /** vendor_prefs.qr_previewed_at, null when never stamped. */
  qrPreviewedAt: string | null;
  /** The vendor has at least one `confirmed` transaction. */
  hasConfirmedPayment: boolean;
  /** vendor_prefs.onboarding_dismissed_at. */
  dismissedAt: string | null;
  /**
   * vendor_prefs.tour_seen_at. Set for every vendor who went through the
   * retired tour, so it now only means "already onboarded".
   */
  tourSeenAt: string | null;
};

export type OnboardingState = {
  /** "hidden" renders nothing; "list" is the checklist; "complete" is the short confirmation. */
  mode: "hidden" | "list" | "complete";
  steps: OnboardingStep[];
  doneCount: number;
  /** Counted steps only; the optional GST step is excluded. */
  totalCount: number;
};

export function deriveOnboarding(input: OnboardingInput): OnboardingState {
  const steps: OnboardingStep[] = [
    {
      id: "paynow",
      title: "Add your PayNow details",
      description:
        "Add your PayNow details or your own payment link so customers have somewhere to pay.",
      href: "/dashboard/config",
      done: input.hasConfig,
      optional: false,
      comingSoon: false,
    },
    {
      id: "preview",
      title: "Preview your QR",
      description:
        "Check the sample QR on Payment setup so you know it will scan.",
      href: "/dashboard/config",
      done: input.qrPreviewedAt !== null,
      optional: false,
      comingSoon: false,
    },
    {
      id: "first-payment",
      title: "Take your first payment and confirm it",
      description:
        "Confirm a payment only after you see the money in your bank app. paykit never touches your funds.",
      href: "/dashboard/transactions",
      done: input.hasConfirmedPayment,
      optional: false,
      comingSoon: false,
    },
    {
      id: "gst",
      title: "GST profile",
      description: "Set up your GST details once GST reporting arrives.",
      href: null,
      done: false,
      optional: true,
      comingSoon: true,
    },
  ];

  const counted = steps.filter((s) => !s.optional);
  const doneCount = counted.filter((s) => s.done).length;
  const totalCount = counted.length;
  const paynowDone = steps[0].done;

  // A vendor who already finished the old tour only sees the card while
  // their payment setup is genuinely missing.
  const eligible =
    input.dismissedAt === null && (input.tourSeenAt === null || !paynowDone);

  let mode: OnboardingState["mode"] = "hidden";
  if (eligible) mode = doneCount === totalCount ? "complete" : "list";

  return { mode, steps, doneCount, totalCount };
}

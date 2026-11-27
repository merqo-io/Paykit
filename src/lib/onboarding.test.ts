import { describe, expect, it } from "vitest";
import { deriveOnboarding, type OnboardingInput } from "./onboarding";

const FRESH: OnboardingInput = {
  hasConfig: false,
  qrPreviewedAt: null,
  hasConfirmedPayment: false,
  dismissedAt: null,
  tourSeenAt: null,
};

const TS = "2026-01-01T00:00:00Z";

describe("deriveOnboarding", () => {
  it("shows the list at 0 of 3 for a brand-new vendor", () => {
    const s = deriveOnboarding(FRESH);
    expect(s.mode).toBe("list");
    expect(s.doneCount).toBe(0);
    expect(s.totalCount).toBe(3);
    expect(s.steps.map((x) => x.id)).toEqual([
      "paynow",
      "preview",
      "first-payment",
      "gst",
    ]);
  });

  it("derives each step from its own signal", () => {
    const s = deriveOnboarding({
      ...FRESH,
      hasConfig: true,
      qrPreviewedAt: TS,
      hasConfirmedPayment: true,
    });
    expect(s.steps.filter((x) => x.done).map((x) => x.id)).toEqual([
      "paynow",
      "preview",
      "first-payment",
    ]);
  });

  it("counts partial progress", () => {
    const s = deriveOnboarding({ ...FRESH, hasConfig: true });
    expect(s.mode).toBe("list");
    expect(s.doneCount).toBe(1);
  });

  it("keeps the GST step optional, greyed and never counted", () => {
    const gst = deriveOnboarding(FRESH).steps.find((x) => x.id === "gst");
    expect(gst).toMatchObject({
      optional: true,
      comingSoon: true,
      done: false,
      href: null,
    });
  });

  it("shows the set-up state once steps 1 to 3 are done, GST untouched", () => {
    const s = deriveOnboarding({
      ...FRESH,
      hasConfig: true,
      qrPreviewedAt: TS,
      hasConfirmedPayment: true,
    });
    expect(s.mode).toBe("complete");
    expect(s.doneCount).toBe(3);
  });

  it("hides once dismissed, even when incomplete", () => {
    expect(deriveOnboarding({ ...FRESH, dismissedAt: TS }).mode).toBe("hidden");
  });

  it("hides the set-up state once dismissed", () => {
    const s = deriveOnboarding({
      hasConfig: true,
      qrPreviewedAt: TS,
      hasConfirmedPayment: true,
      dismissedAt: TS,
      tourSeenAt: null,
    });
    expect(s.mode).toBe("hidden");
  });

  it("hides for an existing vendor (tour seen) whose payment setup is done", () => {
    const s = deriveOnboarding({ ...FRESH, tourSeenAt: TS, hasConfig: true });
    expect(s.mode).toBe("hidden");
  });

  it("shows an existing vendor the list when payment setup is genuinely missing", () => {
    const s = deriveOnboarding({ ...FRESH, tourSeenAt: TS });
    expect(s.mode).toBe("list");
  });

  it("respects dismissal for an existing vendor with no payment setup", () => {
    const s = deriveOnboarding({ ...FRESH, tourSeenAt: TS, dismissedAt: TS });
    expect(s.mode).toBe("hidden");
  });

  it("still shows a new vendor with setup done but later steps pending", () => {
    const s = deriveOnboarding({ ...FRESH, hasConfig: true });
    expect(s.mode).toBe("list");
  });
});

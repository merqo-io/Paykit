import { describe, it, expect, vi } from "vitest";
import { submitLandingFeedback, submitLandingSupport } from "./landing-account";

const support = vi.fn(async (_input: unknown) => ({ success: true as const }));
const feedback = vi.fn(async (_input: unknown) => ({ success: true as const }));
vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: (i: unknown) => support(i),
}));
vi.mock("@/app/actions/feedback", () => ({
  submitFeedbackAction: (i: unknown) => feedback(i),
}));

describe("landing account actions", () => {
  it("maps message to body for support", async () => {
    await submitLandingSupport({ category: "payment", message: "hi" });
    expect(support).toHaveBeenCalledWith({ category: "payment", body: "hi" });
  });

  it("trims feedback and drops an empty message", async () => {
    await submitLandingFeedback({ source: "vendor", nps: 9, message: "  " });
    expect(feedback).toHaveBeenCalledWith({ nps: 9, message: undefined });
  });
});

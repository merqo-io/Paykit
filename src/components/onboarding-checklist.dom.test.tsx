// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { deriveOnboarding, type OnboardingInput } from "@/lib/onboarding";
import { OnboardingChecklist } from "./onboarding-checklist";

const { dismissMock } = vi.hoisted(() => ({
  dismissMock: vi.fn(async () => {}),
}));

vi.mock("@/app/dashboard/onboarding-actions", () => ({
  dismissOnboarding: dismissMock,
}));

const FRESH: OnboardingInput = {
  hasConfig: false,
  qrPreviewedAt: null,
  hasConfirmedPayment: false,
  dismissedAt: null,
  tourSeenAt: null,
};

beforeEach(() => {
  dismissMock.mockClear();
});

describe("OnboardingChecklist", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(
      <OnboardingChecklist
        state={deriveOnboarding({ ...FRESH, dismissedAt: "2026-01-01" })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows progress out of the three counted steps", () => {
    render(
      <OnboardingChecklist
        state={deriveOnboarding({ ...FRESH, hasConfig: true })}
      />,
    );

    expect(screen.getByText("Get set up")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
  });

  it("links the payment steps to Payment setup and the third to payments", () => {
    render(<OnboardingChecklist state={deriveOnboarding(FRESH)} />);

    expect(
      screen.getByRole("link", { name: /Add your PayNow details/ }),
    ).toHaveAttribute("href", "/dashboard/config");
    expect(
      screen.getByRole("link", { name: /Preview your QR/ }),
    ).toHaveAttribute("href", "/dashboard/config");
    expect(
      screen.getByRole("link", { name: /Take your first payment/ }),
    ).toHaveAttribute("href", "/dashboard/transactions");
  });

  it("tells the vendor to confirm only after the money lands in their bank", () => {
    render(<OnboardingChecklist state={deriveOnboarding(FRESH)} />);

    expect(
      screen.getByText(/only after you see the money in your bank app/),
    ).toBeInTheDocument();
  });

  it("shows the GST step greyed as coming soon, without a link", () => {
    render(<OnboardingChecklist state={deriveOnboarding(FRESH)} />);

    expect(screen.getByText("GST profile")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /GST profile/ }),
    ).not.toBeInTheDocument();
  });

  it("dismisses: hides the card and calls the action", () => {
    render(<OnboardingChecklist state={deriveOnboarding(FRESH)} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss setup guide" }),
    );

    expect(screen.queryByText("Get set up")).not.toBeInTheDocument();
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });

  it("shows the set-up state instead of the list when steps 1 to 3 are done", () => {
    render(
      <OnboardingChecklist
        state={deriveOnboarding({
          ...FRESH,
          hasConfig: true,
          qrPreviewedAt: "2026-01-01T00:00:00Z",
          hasConfirmedPayment: true,
        })}
      />,
    );

    expect(screen.getByText("You're set up")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("GST profile")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss setup guide" }),
    );
    expect(screen.queryByText("You're set up")).not.toBeInTheDocument();
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});

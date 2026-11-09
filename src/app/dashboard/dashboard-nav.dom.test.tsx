// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionResult } from "@merqo/ui/kit-api";
import { DashboardNav } from "./dashboard-nav";

const mocks = vi.hoisted(() => ({
  submitFeedbackAction: vi.fn(async (): Promise<ActionResult> => ({
    success: true,
  })),
  submitSupportMessageAction: vi.fn(async (): Promise<ActionResult> => ({
    success: true,
  })),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/app/actions/feedback", () => ({
  submitFeedbackAction: mocks.submitFeedbackAction,
}));
vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: mocks.submitSupportMessageAction,
}));

describe("DashboardNav", () => {
  const baseProps = {
    signOut: vi.fn(async () => {}),
    vendorName: "Kopitiam Cart",
    avatarUrl: null,
    plan: "free" as const,
  };

  it("renders exactly Payments, Bookings and Reports as page links", () => {
    render(<DashboardNav {...baseProps} />);
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "href",
      "/dashboard/transactions",
    );
    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "href",
      "/dashboard/bookings",
    );
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/dashboard/reports",
    );
    expect(
      screen.queryByRole("link", { name: "Payment setup" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("links the wordmark to the dashboard home", () => {
    render(<DashboardNav {...baseProps} />);
    expect(
      screen.getByRole("link", { name: "paykit dashboard home" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("exposes data-tour anchors for the onboarding tour", () => {
    render(<DashboardNav {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /mobile navigation menu/i }),
    ).toHaveAttribute("data-tour", "nav-menu");
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toHaveAttribute("data-tour", "nav-account");
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "data-tour",
      "nav-transactions",
    );
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "data-tour",
      "nav-reports",
    );
  });

  it("account menu holds Payment setup, Profile, Plan, help and feedback, theme, then Sign out", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.map((item) => item.textContent)).toEqual([
      "Switch products",
      "Profile",
      "Plan · Free",
      "Get help",
      "Feedback",
      "Payment setup",
      "Theme · System",
      "Sign out",
    ]);
    expect(screen.getByRole("menuitem", { name: /^Plan/ })).toHaveAttribute(
      "href",
      "/dashboard/plan",
    );
    expect(
      screen.getByRole("menuitem", { name: "Payment setup" }),
    ).toHaveAttribute("href", "/dashboard/config");
  });

  it("calls the signOut action when Sign out is selected", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(baseProps.signOut).toHaveBeenCalled());
  });

  it("shows the vendor's real name as the account subtitle, not a generic label", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    expect(screen.getAllByText("Kopitiam Cart").length).toBeGreaterThan(0);
    expect(screen.queryByText("Vendor account")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getAllByText("Kopitiam Cart").length).toBeGreaterThan(1);
  });

  it("renders the tier badge for the current plan", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} plan="pro" />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("marks no page link current on the dashboard home", () => {
    render(<DashboardNav {...baseProps} />);
    expect(screen.getByRole("link", { name: "Payments" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("Get help opens a form Sheet (not a mailto link) and maps its message to submitSupportMessage's body field", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const getHelp = screen.getByRole("menuitem", { name: "Get help" });
    expect(getHelp.tagName).not.toBe("A");

    await user.click(getHelp);
    await user.click(screen.getByRole("radio", { name: /payment/i }));
    await user.type(
      screen.getByLabelText("Message"),
      "My QR code isn't scanning",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(mocks.submitSupportMessageAction).toHaveBeenCalledWith({
        category: "payment",
        body: "My QR code isn't scanning",
      }),
    );
  });

  it("a failed Get-help submit surfaces an inline error, not a silent failure", async () => {
    mocks.submitSupportMessageAction.mockResolvedValueOnce({
      success: false,
      error: "Could not send your message",
    });
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Get help" }));
    await user.click(screen.getByRole("radio", { name: /payment/i }));
    await user.type(screen.getByLabelText("Message"), "Help");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Could not send your message"),
    ).toBeInTheDocument();
  });

  it("opening Feedback and submitting calls submitFeedback with the picked NPS score", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Feedback" }));

    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.type(screen.getByLabelText("Message"), "Works great");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(mocks.submitFeedbackAction).toHaveBeenCalledWith({
        nps: 9,
        message: "Works great",
      }),
    );
  });

  it("a failed feedback submit surfaces an inline error, not a silent failure", async () => {
    mocks.submitFeedbackAction.mockResolvedValueOnce({
      success: false,
      error: "Could not send feedback",
    });
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Feedback" }));
    await user.click(screen.getByRole("radio", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Could not send feedback"),
    ).toBeInTheDocument();
  });

  it("offers a Switch products submenu linking to the other three live kits", async () => {
    const user = userEvent.setup();
    render(<DashboardNav {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByText(/switch products/i));

    const qkit = await screen.findByRole("menuitem", { name: "qkit" });
    expect(qkit).toHaveAttribute("href", "https://qkit.merqo.io");
    const loopkit = await screen.findByRole("menuitem", { name: "loopkit" });
    expect(loopkit).toHaveAttribute("href", "https://loopkit.merqo.io");
    const stockkit = await screen.findByRole("menuitem", { name: "stockkit" });
    expect(stockkit).toHaveAttribute("href", "https://stockkit.merqo.io");
    // paykit doesn't link to itself.
    expect(
      screen.queryByRole("menuitem", { name: "paykit" }),
    ).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountMenuProps } from "@merqo/ui";

const signOutAction = vi.hoisted(() => vi.fn());
const submitFeedbackAction = vi.hoisted(() => vi.fn());
const submitSupportMessageAction = vi.hoisted(() => vi.fn());
const captured = vi.hoisted(() => ({ props: null as unknown }));

vi.mock("@/app/actions/auth", () => ({ signOutAction }));
vi.mock("@/app/actions/feedback", () => ({ submitFeedbackAction }));
vi.mock("@/app/actions/support", () => ({ submitSupportMessageAction }));

// Wraps the real menu so the touch test exercises it while the handler tests
// can reach the props the wrapper built.
vi.mock("@merqo/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@merqo/ui")>();
  return {
    ...actual,
    AccountMenu: (props: AccountMenuProps) => {
      captured.props = props;
      return <actual.AccountMenu {...props} />;
    },
  };
});

import { LandingAccountMenu } from "./account-menu";

function menuProps(): AccountMenuProps {
  return captured.props as AccountMenuProps;
}

function helpOnSubmit() {
  const help = menuProps().getHelp;
  if (help.type !== "form") throw new Error("expected a form");
  return help.onSubmit;
}

describe("LandingAccountMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    render(<LandingAccountMenu name="Ana" />);
  });

  it("runs the sign-out action when Sign out is touched", async () => {
    const user = userEvent.setup();
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: /account|ana/i }),
    });
    await user.pointer({
      keys: "[TouchA]",
      target: await screen.findByRole("menuitem", { name: /sign out/i }),
    });
    expect(signOutAction).toHaveBeenCalledTimes(1);
  });

  it("sends a help request with a known category", async () => {
    submitSupportMessageAction.mockResolvedValue({ success: true });
    const category =
      menuProps().getHelp.type === "form"
        ? (menuProps().getHelp as { categories?: { value: string }[] })
            .categories?.[0]?.value
        : undefined;
    await helpOnSubmit()({ message: "hi", category });
    expect(submitSupportMessageAction).toHaveBeenCalledWith({
      category,
      body: "hi",
    });
  });

  it("falls back to the other category for an unknown one", async () => {
    submitSupportMessageAction.mockResolvedValue({ success: true });
    await helpOnSubmit()({ message: "hi", category: "nonsense" });
    expect(submitSupportMessageAction).toHaveBeenCalledWith({
      category: "other",
      body: "hi",
    });
  });

  it("throws the server error when the help request fails", async () => {
    submitSupportMessageAction.mockResolvedValue({
      success: false,
      error: "nope",
    });
    await expect(helpOnSubmit()({ message: "hi" })).rejects.toThrow("nope");
  });

  it("submits feedback and omits an empty message", async () => {
    submitFeedbackAction.mockResolvedValue({ success: true });
    await menuProps().onFeedbackSubmit({
      source: "vendor",
      message: "  ",
      nps: 9,
    });
    expect(submitFeedbackAction).toHaveBeenCalledWith({
      nps: 9,
      message: undefined,
    });
    await menuProps().onFeedbackSubmit({
      source: "vendor",
      message: " great ",
    });
    expect(submitFeedbackAction).toHaveBeenLastCalledWith({
      nps: 0,
      message: "great",
    });
  });

  it("throws the server error when feedback fails", async () => {
    submitFeedbackAction.mockResolvedValue({ success: false, error: "bad" });
    await expect(
      menuProps().onFeedbackSubmit({ source: "vendor", message: "x", nps: 1 }),
    ).rejects.toThrow("bad");
  });
});

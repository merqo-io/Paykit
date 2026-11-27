// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreditCard, Home } from "lucide-react";
import { BottomTabBar } from "./bottom-tab-bar";
import { MoreSheet } from "./more-sheet";
import { SideRail } from "./side-rail";
import type { NavLinkItem } from "./types";

const items: NavLinkItem[] = [
  { key: "home", label: "Home", href: "/dashboard", icon: Home },
  {
    key: "payments",
    label: "Payments",
    href: "/dashboard/transactions",
    icon: CreditCard,
    badge: 3,
    badgeLabel: "waiting to confirm",
  },
];

describe("BottomTabBar", () => {
  const baseProps = {
    items,
    isActive: (href: string) => href === "/dashboard",
    moreActive: false,
    moreOpen: false,
    onMoreClick: vi.fn(),
  };

  it("shows each item plus More, hidden from lg up and in print", () => {
    render(<BottomTabBar {...baseProps} />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass("lg:hidden", "print:hidden");
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(within(nav).getByRole("button", { name: "More" })).toBeVisible();
  });

  it("marks only the active tab as the current page", () => {
    render(<BottomTabBar {...baseProps} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Payments/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("badges the count with screen-reader text and omits a zero badge", () => {
    const { rerender } = render(<BottomTabBar {...baseProps} />);
    expect(
      screen.getByRole("link", { name: "Payments, 3 waiting to confirm" }),
    ).toBeInTheDocument();
    rerender(
      <BottomTabBar
        {...baseProps}
        items={[items[0], { ...items[1], badge: 0 }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Payments" })).toBeInTheDocument();
  });

  it("calls onMoreClick from the More button", async () => {
    const onMoreClick = vi.fn();
    render(<BottomTabBar {...baseProps} onMoreClick={onMoreClick} />);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });
});

describe("SideRail", () => {
  it("renders the links as a lg-only nav, with badge, chip and active state", () => {
    render(
      <SideRail
        items={[items[0], { ...items[1], chip: <span>Pro</span> }]}
        isActive={(href) => href === "/dashboard/transactions"}
      />,
    );
    expect(screen.getByRole("complementary")).toHaveClass(
      "hidden",
      "lg:block",
      "print:hidden",
    );
    const payments = screen.getByRole("link", { name: /Payments/ });
    expect(payments).toHaveAttribute("aria-current", "page");
    expect(within(payments).getByText("Pro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("MoreSheet", () => {
  const moreItems: NavLinkItem[] = [
    { key: "plan", label: "Plan", href: "/dashboard/plan", icon: Home },
  ];

  it("lists the items and legal links when open", () => {
    render(
      <MoreSheet
        open
        onOpenChange={vi.fn()}
        items={moreItems}
        isActive={() => false}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute(
      "href",
      "/dashboard/plan",
    );
    for (const name of ["About", "FAQ", "Terms", "Privacy"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("renders nothing when closed and closes after a link is chosen", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <MoreSheet
        open={false}
        onOpenChange={onOpenChange}
        items={moreItems}
        isActive={() => false}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <MoreSheet
        open
        onOpenChange={onOpenChange}
        items={moreItems}
        isActive={() => false}
      />,
    );
    await userEvent.click(screen.getByRole("link", { name: "Plan" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a Setup guide row only when given an action, which closes the sheet and runs it", async () => {
    const onOpenChange = vi.fn();
    const onSetupGuide = vi.fn();
    const { rerender } = render(
      <MoreSheet
        open
        onOpenChange={onOpenChange}
        items={moreItems}
        isActive={() => false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Setup guide" }),
    ).not.toBeInTheDocument();
    rerender(
      <MoreSheet
        open
        onOpenChange={onOpenChange}
        items={moreItems}
        isActive={() => false}
        onSetupGuide={onSetupGuide}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Setup guide" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSetupGuide).toHaveBeenCalledTimes(1);
  });

  it("closes when the viewport grows to the rail breakpoint", () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: (_: string, fn: typeof listener) => (listener = fn),
      removeEventListener: () => {},
    }));
    const onOpenChange = vi.fn();
    render(
      <MoreSheet
        open
        onOpenChange={onOpenChange}
        items={moreItems}
        isActive={() => false}
      />,
    );
    listener?.({ matches: false });
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => listener?.({ matches: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });
});

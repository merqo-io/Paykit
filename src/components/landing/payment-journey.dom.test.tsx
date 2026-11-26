// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentJourney } from "./payment-journey";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

it("tells the story in exactly three steps", () => {
  render(<PaymentJourney />);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  expect(screen.getByText("Step 3")).toBeInTheDocument();
});

it("reduced motion starts every step unplayed and keeps the buttons usable", async () => {
  stubReducedMotion(true);
  render(<PaymentJourney />);
  expect(screen.queryByText("Sent by PayNow to Ah Seng Kopi.")).toBeNull();
  expect(screen.queryByText(/Ah Seng Kopi confirmed it/)).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Pay S$7.80" }));
  expect(screen.getByText("Sent by PayNow to Ah Seng Kopi.")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm payment" }),
  );
  expect(screen.getByText(/Ah Seng Kopi confirmed it/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm payment" })).toBeNull();
});

it("a tap plays a step when scroll has not", async () => {
  stubReducedMotion(false);
  vi.stubGlobal("innerHeight", 800);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 5000,
    height: 300,
  } as DOMRect);
  render(<PaymentJourney />);
  expect(screen.queryByText(/Ah Seng Kopi confirmed it/)).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm payment" }),
  );
  expect(screen.getByText(/Ah Seng Kopi confirmed it/)).toBeInTheDocument();
});

it("a tap lapses when scroll moves on, so scrolling back up still rewinds", async () => {
  stubReducedMotion(false);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  let top = 5000;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top, height: 300 }) as DOMRect,
  );
  render(<PaymentJourney />);
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm payment" }),
  );
  expect(screen.getByText(/Ah Seng Kopi confirmed it/)).toBeInTheDocument();

  top = 100;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
  expect(screen.getByText(/Ah Seng Kopi confirmed it/)).toBeInTheDocument();

  top = 5000;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
  expect(screen.queryByText(/Ah Seng Kopi confirmed it/)).toBeNull();
  expect(
    screen.getByRole("button", { name: "Confirm payment" }),
  ).toBeInTheDocument();
});

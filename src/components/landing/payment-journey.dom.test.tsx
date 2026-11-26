// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

it("reduced motion shows every step complete", () => {
  stubReducedMotion(true);
  render(<PaymentJourney />);
  expect(screen.getByText("Sent by PayNow to Ah Seng Kopi.")).toBeVisible();
  expect(screen.getAllByText(/You said paid/).length).toBeGreaterThan(0);
  expect(
    screen.getAllByText(/Ah Seng Kopi confirmed it/).length,
  ).toBeGreaterThan(0);
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

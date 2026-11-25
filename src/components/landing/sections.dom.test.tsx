// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClosingCta, HowItWorks, LandingFaq, YourMoney } from "./sections";

it("explains the three steps in order without icons or eyebrows", () => {
  const { container } = render(<HowItWorks />);
  expect(container.querySelectorAll("li")).toHaveLength(3);
  expect(container.querySelector("svg")).toBeNull();
  expect(container.querySelector('[class*="uppercase"]')).toBeNull();
});

it("says paykit never holds funds", () => {
  render(<YourMoney />);
  expect(screen.getByText(/never holds funds/)).toBeInTheDocument();
});

it("answers the pricing question with the pilot line", () => {
  const { container } = render(<LandingFaq />);
  expect(container.textContent).toContain("Free during the pilot");
});

it("closes with a single waitlist link", () => {
  render(<ClosingCta />);
  expect(
    screen.getAllByRole("link", { name: "Join the waitlist" }),
  ).toHaveLength(1);
});

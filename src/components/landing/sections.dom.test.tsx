// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorks, LandingFaq, YourMoney } from "./sections";

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

it("pairs the pilot pricing line with the single waitlist CTA", () => {
  const { container } = render(<LandingFaq />);
  expect(container.textContent).toContain("Free during the pilot");
  expect(
    screen.getAllByRole("link", { name: "Join the waitlist" }),
  ).toHaveLength(1);
});

it("does not repeat the pricing question as an FAQ row", () => {
  render(<LandingFaq />);
  expect(screen.queryByText("What will it cost?")).toBeNull();
});
